package com.photlas.backend.service;

import com.photlas.backend.dto.LoginRequest;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.RegisterResponse;
import com.photlas.backend.dto.UpdateProfileRequest;
import com.photlas.backend.dto.UserProfileResponse;
import com.photlas.backend.entity.PasswordResetToken;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserSnsLink;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.repository.PasswordResetTokenRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.repository.UserSnsLinkRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private JavaMailSender mailSender;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private UserSnsLinkRepository userSnsLinkRepository;

    @Autowired
    private S3Service s3Service;

    public RegisterResponse registerUser(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());

        User user = new User(
            request.getUsername(),
            request.getEmail(),
            hashedPassword,
            "USER"
        );

        user = userRepository.save(user);

        String token = jwtService.generateToken(user.getEmail());

        sendWelcomeEmail(user.getEmail(), user.getUsername());

        return new RegisterResponse(
            new RegisterResponse.UserResponse(user),
            token
        );
    }

    public RegisterResponse loginUser(LoginRequest request) {
        Optional<User> userOptional = userRepository.findByEmail(request.getEmail());

        if (userOptional.isEmpty()) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        User user = userOptional.get();

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        String token = jwtService.generateToken(user.getEmail());

        return new RegisterResponse(
            new RegisterResponse.UserResponse(user),
            token
        );
    }

    /**
     * パスワードリセットリクエスト処理
     * Issue#6: パスワードリセット機能
     *
     * @param email リセット対象のメールアドレス
     */
    public void requestPasswordReset(String email) {
        Optional<User> userOptional = userRepository.findByEmail(email);

        // セキュリティ上、メールアドレスが存在しない場合でも同じ処理を行う
        if (userOptional.isEmpty()) {
            // ユーザーが存在しないが、同じレスポンスを返すため何もしない
            return;
        }

        User user = userOptional.get();

        // 既存のトークンがあれば削除
        passwordResetTokenRepository.findByUserId(user.getId()).ifPresent(
            token -> passwordResetTokenRepository.delete(token)
        );

        // 新しいトークンを生成
        String token = generateSecureToken();
        Date expiryDate = new Date(System.currentTimeMillis() + 30 * 60 * 1000); // 30分後

        // トークンを保存
        PasswordResetToken resetToken = new PasswordResetToken(user.getId(), token, expiryDate);
        passwordResetTokenRepository.save(resetToken);

        // パスワードリセットメールを送信
        sendPasswordResetEmail(email, token);
    }

    /**
     * パスワード再設定処理
     * Issue#6: パスワードリセット機能
     *
     * @param token トークン
     * @param newPassword 新しいパスワード
     * @param confirmPassword 確認用パスワード
     */
    public void resetPassword(String token, String newPassword, String confirmPassword) {
        // パスワードの一致確認
        if (!newPassword.equals(confirmPassword)) {
            throw new IllegalArgumentException("パスワードが一致しません");
        }

        // トークンの検証
        Optional<PasswordResetToken> tokenOptional = passwordResetTokenRepository.findByToken(token);
        if (tokenOptional.isEmpty()) {
            throw new IllegalArgumentException("トークンが無効または期限切れです");
        }

        PasswordResetToken resetToken = tokenOptional.get();

        // 有効期限の確認
        if (resetToken.getExpiryDate().before(new Date())) {
            passwordResetTokenRepository.delete(resetToken);
            throw new IllegalArgumentException("トークンが無効または期限切れです");
        }

        // ユーザーを取得
        Optional<User> userOptional = userRepository.findById(resetToken.getUserId());
        if (userOptional.isEmpty()) {
            throw new IllegalArgumentException("ユーザーが見つかりません");
        }

        User user = userOptional.get();

        // パスワードをハッシュ化して更新
        String hashedPassword = passwordEncoder.encode(newPassword);
        user.setPasswordHash(hashedPassword);
        userRepository.save(user);

        // トークンを削除（無効化）
        passwordResetTokenRepository.delete(resetToken);
    }

    /**
     * 安全なトークンを生成
     *
     * @return 生成されたトークン
     */
    private String generateSecureToken() {
        // UUIDをBase64エンコードして推測困難なトークンを生成
        String uuid = UUID.randomUUID().toString() + UUID.randomUUID().toString();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(uuid.getBytes());
    }

    /**
     * パスワードリセットメールを送信
     *
     * @param email 送信先メールアドレス
     * @param token リセットトークン
     */
    private void sendPasswordResetEmail(String email, String token) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(email);
            message.setSubject("【Photlas】パスワードの再設定");
            message.setText("パスワード再設定のリクエストを受け付けました。\n\n" +
                           "以下のリンクをクリックして、パスワードを再設定してください：\n" +
                           "http://localhost:5173/reset-password?token=" + token + "\n\n" +
                           "このリンクの有効期限は30分です。\n\n" +
                           "このメールに心当たりがない場合は、このメールを無視してください。\n\n" +
                           "Best regards,\n" +
                           "The Photlas Team");

            mailSender.send(message);
        } catch (Exception e) {
            // Log the error but don't fail the request
            System.err.println("Failed to send password reset email: " + e.getMessage());
        }
    }

    private void sendWelcomeEmail(String email, String username) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(email);
            message.setSubject("Welcome to Photlas!");
            message.setText("Hello " + username + ",\n\n" +
                           "Welcome to Photlas! Your account has been successfully created.\n\n" +
                           "You can now start exploring and sharing your favorite photography spots.\n\n" +
                           "Best regards,\n" +
                           "The Photlas Team");

            mailSender.send(message);
        } catch (Exception e) {
            // Log the error but don't fail registration
            System.err.println("Failed to send welcome email: " + e.getMessage());
        }
    }

    /**
     * 自分のユーザー情報を取得（Issue#18）
     *
     * @param email ログイン中ユーザーのメールアドレス
     * @return ユーザープロフィール情報
     */
    @Transactional(readOnly = true)
    public UserProfileResponse getMyProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

        List<UserSnsLink> snsLinks = userSnsLinkRepository.findByUserId(user.getId());
        List<UserProfileResponse.SnsLink> snsLinkDtos = snsLinks.stream()
                .map(link -> new UserProfileResponse.SnsLink(link.getUrl()))
                .collect(Collectors.toList());

        String profileImageUrl = s3Service.generateCdnUrl(user.getProfileImageS3Key());

        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                profileImageUrl,
                snsLinkDtos
        );
    }

    /**
     * 他ユーザーのプロフィール情報を取得（Issue#18）
     *
     * @param userId ユーザーID
     * @return ユーザープロフィール情報（emailは含まない）
     */
    @Transactional(readOnly = true)
    public UserProfileResponse getUserProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

        List<UserSnsLink> snsLinks = userSnsLinkRepository.findByUserId(user.getId());
        List<UserProfileResponse.SnsLink> snsLinkDtos = snsLinks.stream()
                .map(link -> new UserProfileResponse.SnsLink(link.getUrl()))
                .collect(Collectors.toList());

        String profileImageUrl = s3Service.generateCdnUrl(user.getProfileImageS3Key());

        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                null, // emailは含まない
                profileImageUrl,
                snsLinkDtos
        );
    }

    /**
     * プロフィール情報を更新（Issue#18）
     *
     * @param email ログイン中ユーザーのメールアドレス
     * @param request 更新リクエスト
     * @return 更新後のユーザープロフィール情報
     */
    @Transactional
    public UserProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

        // ユーザー名重複チェック（自分以外）
        Optional<User> existingUser = userRepository.findByUsername(request.getUsername());
        if (existingUser.isPresent() && !existingUser.get().getId().equals(user.getId())) {
            throw new IllegalArgumentException("このユーザー名はすでに使用されています");
        }

        // ユーザー名を更新
        user.setUsername(request.getUsername());

        // プロフィール画像S3キーを更新
        if (request.getProfileImageS3Key() != null) {
            user.setProfileImageS3Key(request.getProfileImageS3Key());
        }

        userRepository.save(user);

        // SNSリンクを一括置換
        userSnsLinkRepository.deleteByUserId(user.getId());
        if (request.getSnsLinks() != null) {
            for (UpdateProfileRequest.SnsLinkRequest snsLinkRequest : request.getSnsLinks()) {
                UserSnsLink snsLink = new UserSnsLink(user.getId(), snsLinkRequest.getUrl());
                userSnsLinkRepository.save(snsLink);
            }
        }

        // 更新後のプロフィールを取得して返す
        return getMyProfile(email);
    }

    /**
     * メールアドレス変更（Issue#20）
     *
     * @param email ログイン中ユーザーのメールアドレス
     * @param newEmail 新しいメールアドレス
     * @param currentPassword 現在のパスワード
     * @return 更新後のメールアドレス
     */
    @Transactional
    public String updateEmail(String email, String newEmail, String currentPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

        // パスワード検証
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new UnauthorizedException("パスワードが正しくありません");
        }

        // 同じメールアドレスの場合は成功を返す（決定事項）
        if (email.equals(newEmail)) {
            return user.getEmail();
        }

        // メールアドレス重複チェック（自分以外）
        Optional<User> existingUser = userRepository.findByEmail(newEmail);
        if (existingUser.isPresent() && !existingUser.get().getId().equals(user.getId())) {
            throw new ConflictException("このメールアドレスはすでに使用されています");
        }

        // メールアドレスを更新
        user.setEmail(newEmail);
        userRepository.save(user);

        return user.getEmail();
    }

    /**
     * パスワード変更（Issue#20）
     *
     * @param email ログイン中ユーザーのメールアドレス
     * @param currentPassword 現在のパスワード
     * @param newPassword 新しいパスワード
     * @param newPasswordConfirm 新しいパスワード（確認用）
     */
    @Transactional
    public void updatePassword(String email, String currentPassword, String newPassword, String newPasswordConfirm) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

        // 現在のパスワード検証
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new UnauthorizedException("現在のパスワードが正しくありません");
        }

        // 新しいパスワードの一致確認
        if (!newPassword.equals(newPasswordConfirm)) {
            throw new IllegalArgumentException("新しいパスワードが一致しません");
        }

        // パスワードをハッシュ化して更新
        String hashedPassword = passwordEncoder.encode(newPassword);
        user.setPasswordHash(hashedPassword);
        userRepository.save(user);
    }

    /**
     * アカウント削除（Issue#20）
     *
     * @param email ログイン中ユーザーのメールアドレス
     * @param password パスワード
     */
    @Transactional
    public void deleteAccount(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

        // パスワード検証
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new UnauthorizedException("パスワードが正しくありません");
        }

        // ユーザーを削除（CASCADE設定により関連データも削除される）
        userRepository.delete(user);
    }
}