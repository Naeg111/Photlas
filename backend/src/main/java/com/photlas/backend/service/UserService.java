package com.photlas.backend.service;

import com.photlas.backend.dto.LoginRequest;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.RegisterResponse;
import com.photlas.backend.dto.UpdateProfileRequest;
import com.photlas.backend.dto.UpdateSnsLinksRequest;
import com.photlas.backend.dto.UserProfileResponse;
import com.photlas.backend.entity.PasswordResetToken;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserSnsLink;
import com.photlas.backend.exception.AccountSuspendedException;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.entity.EmailVerificationToken;
import com.photlas.backend.repository.EmailVerificationTokenRepository;
import com.photlas.backend.repository.PasswordResetTokenRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.repository.UserSnsLinkRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Base64;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * ユーザーサービス
 * ユーザー登録、認証、プロフィール管理などのビジネスロジックを提供します。
 */
@Service
public class UserService {

    private static final Logger logger = LoggerFactory.getLogger(UserService.class);
    private static final int PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES = 30;
    private static final int EMAIL_VERIFICATION_TOKEN_EXPIRATION_HOURS = 24;

    // Issue#29: SNSプラットフォーム定数
    private static final List<String> ALLOWED_PLATFORMS = List.of("twitter", "instagram", "youtube", "tiktok");

    // Issue#29: エラーメッセージ定数
    private static final String ERROR_USER_NOT_FOUND = "ユーザーが見つかりません";
    private static final String ERROR_USERNAME_ALREADY_EXISTS = "このユーザー名はすでに使用されています";
    private static final String ERROR_UNSUPPORTED_PLATFORM = "未対応のプラットフォームです: ";
    private static final String ERROR_DUPLICATE_PLATFORM = "同じプラットフォームが重複しています: ";
    private static final String ERROR_INVALID_URL_FOR_PLATFORM = "URLがプラットフォームと一致しません";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JavaMailSender mailSender;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final UserSnsLinkRepository userSnsLinkRepository;
    private final S3Service s3Service;

    @Value("${app.frontend-url:https://photlas.jp}")
    private String frontendUrl;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            JavaMailSender mailSender,
            PasswordResetTokenRepository passwordResetTokenRepository,
            EmailVerificationTokenRepository emailVerificationTokenRepository,
            UserSnsLinkRepository userSnsLinkRepository,
            S3Service s3Service) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.mailSender = mailSender;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.emailVerificationTokenRepository = emailVerificationTokenRepository;
        this.userSnsLinkRepository = userSnsLinkRepository;
        this.s3Service = s3Service;
    }

    /**
     * ユーザー登録処理
     * メール認証トークンを生成し、認証メールを送信する。
     * JWTトークンも返すが、メール認証が完了するまでログインは不可。
     *
     * @param request 登録リクエスト
     * @return 登録レスポンス（JWT付き、プロフィール設定用）
     */
    public RegisterResponse registerUser(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ConflictException("このメールアドレスは既に登録されています");
        }

        String hashedPassword = passwordEncoder.encode(request.getPassword());

        User user = new User(
            request.getUsername(),
            request.getEmail(),
            hashedPassword,
            "USER"
        );

        user = userRepository.save(user);

        String token = jwtService.generateTokenWithRole(user.getEmail(), user.getRole());

        // メール認証トークンを生成して送信
        sendVerificationEmail(user);

        return new RegisterResponse(
            new RegisterResponse.UserResponse(user),
            token
        );
    }

    /**
     * ログイン処理
     * メール認証が完了していない場合はログインを拒否する。
     *
     * @param request ログインリクエスト
     * @return ログインレスポンス
     */
    public RegisterResponse loginUser(LoginRequest request) {
        Optional<User> userOptional = userRepository.findByEmail(request.getEmail());

        if (userOptional.isEmpty()) {
            throw new IllegalArgumentException("メールアドレスまたはパスワードが正しくありません");
        }

        User user = userOptional.get();

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("メールアドレスまたはパスワードが正しくありません");
        }

        if (!user.isEmailVerified()) {
            throw new IllegalArgumentException("メールアドレスが認証されていません。認証メール内のリンクをクリックしてください。");
        }

        // Issue#54: 永久停止アカウントのログインブロック
        if ("SUSPENDED".equals(user.getRole())) {
            throw new AccountSuspendedException("アカウントが停止されています");
        }

        String token = jwtService.generateTokenWithRole(user.getEmail(), user.getRole());

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
        Date expiryDate = new Date(System.currentTimeMillis() + PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES * 60 * 1000);

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
                           frontendUrl + "/reset-password?token=" + token + "\n\n" +
                           "このリンクの有効期限は30分です。\n\n" +
                           "このメールに心当たりがない場合は、このメールを無視してください。\n\n" +
                           "Photlas チーム");

            mailSender.send(message);
        } catch (Exception e) {
            // Log the error but don't fail the request
            logger.error("Failed to send password reset email: {}", e.getMessage());
        }
    }

    /**
     * メール認証トークンを生成して認証メールを送信
     *
     * @param user 対象ユーザー
     */
    private void sendVerificationEmail(User user) {
        // 既存のトークンがあれば削除
        emailVerificationTokenRepository.findByUserId(user.getId()).ifPresent(
            token -> emailVerificationTokenRepository.delete(token)
        );

        String token = generateSecureToken();
        Date expiryDate = new Date(System.currentTimeMillis()
                + EMAIL_VERIFICATION_TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000);

        EmailVerificationToken verificationToken = new EmailVerificationToken(
                user.getId(), token, expiryDate);
        emailVerificationTokenRepository.save(verificationToken);

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(user.getEmail());
            message.setSubject("【Photlas】メールアドレスの確認");
            message.setText(user.getUsername() + " さん\n\n" +
                           "Photlasへのご登録ありがとうございます！\n" +
                           "以下のリンクをクリックして、メールアドレスを確認してください：\n\n" +
                           frontendUrl + "/verify-email?token=" + token + "\n\n" +
                           "このリンクの有効期限は24時間です。\n\n" +
                           "このメールに心当たりがない場合は、このメールを無視してください。\n\n" +
                           "Photlas チーム");

            mailSender.send(message);
        } catch (Exception e) {
            logger.error("Failed to send verification email: {}", e.getMessage());
        }
    }

    /**
     * メールアドレスを認証する
     *
     * @param token 認証トークン
     */
    @Transactional
    public void verifyEmail(String token) {
        Optional<EmailVerificationToken> tokenOptional =
                emailVerificationTokenRepository.findByToken(token);

        if (tokenOptional.isEmpty()) {
            throw new IllegalArgumentException("認証トークンが無効または期限切れです");
        }

        EmailVerificationToken verificationToken = tokenOptional.get();

        if (verificationToken.getExpiryDate().before(new Date())) {
            emailVerificationTokenRepository.delete(verificationToken);
            throw new IllegalArgumentException("認証トークンが無効または期限切れです");
        }

        Optional<User> userOptional = userRepository.findById(verificationToken.getUserId());
        if (userOptional.isEmpty()) {
            throw new IllegalArgumentException("ユーザーが見つかりません");
        }

        User user = userOptional.get();
        user.setEmailVerified(true);
        userRepository.save(user);

        emailVerificationTokenRepository.delete(verificationToken);
    }

    /**
     * 認証メールを再送信する
     *
     * @param email メールアドレス
     */
    @Transactional
    public void resendVerificationEmail(String email) {
        Optional<User> userOptional = userRepository.findByEmail(email);

        if (userOptional.isEmpty()) {
            // セキュリティ上、メールアドレスが存在しない場合でも同じレスポンスを返す
            return;
        }

        User user = userOptional.get();

        if (user.isEmailVerified()) {
            throw new IllegalArgumentException("このメールアドレスは既に認証済みです");
        }

        sendVerificationEmail(user);
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
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

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
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

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
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

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
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

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
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

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
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        // パスワード検証
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new UnauthorizedException("パスワードが正しくありません");
        }

        // ユーザーを削除（CASCADE設定により関連データも削除される）
        userRepository.delete(user);
    }

    // ============================================================
    // Issue#29: プロフィール機能強化
    // ============================================================

    /**
     * プロフィール画像を更新（Issue#29）
     *
     * @param email ログイン中ユーザーのメールアドレス
     * @param objectKey S3オブジェクトキー
     * @return プロフィール画像URL
     */
    @Transactional
    public String updateProfileImage(String email, String objectKey) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        user.setProfileImageS3Key(objectKey);
        userRepository.save(user);

        return s3Service.generateCdnUrl(objectKey);
    }

    /**
     * プロフィール画像を削除（Issue#29）
     *
     * @param email ログイン中ユーザーのメールアドレス
     */
    @Transactional
    public void deleteProfileImage(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        user.setProfileImageS3Key(null);
        userRepository.save(user);
    }

    /**
     * SNSリンクを更新（Issue#29）
     *
     * @param email ログイン中ユーザーのメールアドレス
     * @param snsLinks SNSリンクリスト
     * @return 更新後のSNSリンクリスト
     */
    @Transactional
    public List<UserSnsLink> updateSnsLinks(String email, List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        // バリデーション
        validateSnsLinks(snsLinks);

        // SNSリンクを一括置換
        userSnsLinkRepository.deleteByUserId(user.getId());

        if (snsLinks != null) {
            for (var snsLinkRequest : snsLinks) {
                UserSnsLink snsLink = new UserSnsLink(
                        user.getId(),
                        snsLinkRequest.getPlatform(),
                        snsLinkRequest.getUrl()
                );
                userSnsLinkRepository.save(snsLink);
            }
        }

        return userSnsLinkRepository.findByUserId(user.getId());
    }

    /**
     * SNSリンクのバリデーション（Issue#29）
     *
     * @param snsLinks バリデーション対象のSNSリンクリスト
     */
    private void validateSnsLinks(List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks) {
        if (snsLinks == null) {
            return;
        }

        Set<String> platforms = new HashSet<>();
        for (UpdateSnsLinksRequest.SnsLinkRequest snsLink : snsLinks) {
            // プラットフォームのバリデーション
            if (!ALLOWED_PLATFORMS.contains(snsLink.getPlatform())) {
                throw new IllegalArgumentException(ERROR_UNSUPPORTED_PLATFORM + snsLink.getPlatform());
            }
            // プラットフォーム重複チェック
            if (!platforms.add(snsLink.getPlatform())) {
                throw new IllegalArgumentException(ERROR_DUPLICATE_PLATFORM + snsLink.getPlatform());
            }
            // URLとプラットフォームの整合性チェック
            if (!isValidUrlForPlatform(snsLink.getPlatform(), snsLink.getUrl())) {
                throw new IllegalArgumentException(ERROR_INVALID_URL_FOR_PLATFORM);
            }
        }
    }

    /**
     * URLとプラットフォームの整合性チェック（Issue#29）
     *
     * @param platform プラットフォーム
     * @param url URL
     * @return 整合性がある場合true
     */
    private boolean isValidUrlForPlatform(String platform, String url) {
        return switch (platform) {
            case "twitter" -> url.contains("x.com") || url.contains("twitter.com");
            case "instagram" -> url.contains("instagram.com");
            case "youtube" -> url.contains("youtube.com");
            case "tiktok" -> url.contains("tiktok.com");
            default -> false;
        };
    }

    /**
     * ユーザー名を更新（Issue#29）
     *
     * @param email ログイン中ユーザーのメールアドレス
     * @param username 新しいユーザー名
     * @return 更新後のユーザー名
     */
    @Transactional
    public String updateUsername(String email, String username) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        // ユーザー名重複チェック（自分以外）
        Optional<User> existingUser = userRepository.findByUsername(username);
        if (existingUser.isPresent() && !existingUser.get().getId().equals(user.getId())) {
            throw new ConflictException(ERROR_USERNAME_ALREADY_EXISTS);
        }

        user.setUsername(username);
        userRepository.save(user);

        return user.getUsername();
    }
}