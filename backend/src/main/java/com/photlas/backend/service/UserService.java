package com.photlas.backend.service;

import com.photlas.backend.dto.LoginRequest;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.RegisterResponse;
import com.photlas.backend.entity.PasswordResetToken;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PasswordResetTokenRepository;
import com.photlas.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

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
}