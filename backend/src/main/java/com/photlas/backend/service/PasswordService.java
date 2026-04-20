package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.PasswordResetToken;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.repository.PasswordResetTokenRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.util.TokenGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.Optional;

/**
 * パスワードサービス
 * パスワードリセット、パスワード変更のビジネスロジックを提供する。
 */
@Service
public class PasswordService {

    private static final Logger logger = LoggerFactory.getLogger(PasswordService.class);
    private static final int PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES = 30;
    private static final String ERROR_USER_NOT_FOUND = "ユーザーが見つかりません";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailService emailService;

    @Value("${app.frontend-url:https://photlas.jp}")
    private String frontendUrl;

    public PasswordService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            PasswordResetTokenRepository passwordResetTokenRepository,
            EmailService emailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.emailService = emailService;
    }

    /**
     * パスワードリセットリクエスト処理
     *
     * @param email リセット対象のメールアドレス
     */
    @Transactional
    public void requestPasswordReset(String email) {
        Optional<User> userOptional = userRepository.findByEmail(email.toLowerCase());

        if (userOptional.isEmpty()) {
            return;
        }

        User user = userOptional.get();

        // Issue#92: 退会済みユーザーにはパスワードリセットを許可（アカウント復旧のため）
        // 停止中かつアクティブなユーザーにはリセットメールを送信しない（レスポンスは正常時と同一）
        if (user.getDeletedAt() == null && Integer.valueOf(CodeConstants.ROLE_SUSPENDED).equals(user.getRole())) {
            return;
        }

        passwordResetTokenRepository.findByUserId(user.getId()).ifPresent(
            token -> passwordResetTokenRepository.delete(token)
        );

        String token = TokenGenerator.generateSecureToken();
        Date expiryDate = new Date(System.currentTimeMillis() + PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES * 60 * 1000);

        PasswordResetToken resetToken = new PasswordResetToken(user.getId(), token, expiryDate);
        passwordResetTokenRepository.save(resetToken);

        sendPasswordResetEmail(user.getEmail(), token, user.getLanguage());
    }

    /**
     * パスワード再設定処理
     *
     * @param token トークン
     * @param newPassword 新しいパスワード
     */
    @Transactional
    public void resetPassword(String token, String newPassword) {
        Optional<PasswordResetToken> tokenOptional = passwordResetTokenRepository.findByToken(token);
        if (tokenOptional.isEmpty()) {
            throw new IllegalArgumentException("トークンが無効または期限切れです");
        }

        PasswordResetToken resetToken = tokenOptional.get();

        if (resetToken.getExpiryDate().before(new Date())) {
            passwordResetTokenRepository.delete(resetToken);
            throw new IllegalArgumentException("トークンが無効または期限切れです");
        }

        Optional<User> userOptional = userRepository.findById(resetToken.getUserId());
        if (userOptional.isEmpty()) {
            throw new IllegalArgumentException(ERROR_USER_NOT_FOUND);
        }

        User user = userOptional.get();

        String hashedPassword = passwordEncoder.encode(newPassword);
        user.setPasswordHash(hashedPassword);
        userRepository.save(user);

        passwordResetTokenRepository.delete(resetToken);

        sendPasswordChangedNotification(user.getEmail(), user.getUsername(), user.getLanguage());
    }

    /**
     * Issue#81 Phase 4e: OAuth のみユーザー向けの初回パスワード設定。
     *
     * <p>password_hash が null のユーザーが任意でパスワードを追加するときに使う。
     * 成功時は {@code password_recommendation_dismissed_at} を NULL に明示リセット
     * （Round 12 / Q8、将来の条件変更に備えて明示クリア）。
     *
     * @param email       対象ユーザーのメールアドレス
     * @param newPassword 新しく設定するパスワード
     * @throws UnauthorizedException ユーザーが存在しない場合
     * @throws ConflictException     既に password_hash が設定されている場合
     */
    @Transactional
    public void setInitialPassword(String email, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        if (user.getPasswordHash() != null) {
            throw new ConflictException("パスワードは既に設定されています。変更するには updatePassword を使用してください。");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        // Round 12 / Q8: password_hash != null となりバナー表示条件を満たさなくなるが、
        // 将来の条件変更に備えて dismissed_at を明示クリア
        user.setPasswordRecommendationDismissedAt(null);
        userRepository.save(user);

        sendPasswordChangedNotification(email, user.getUsername(), user.getLanguage());
    }

    /**
     * パスワード変更
     *
     * @param email ログイン中ユーザーのメールアドレス
     * @param currentPassword 現在のパスワード
     * @param newPassword 新しいパスワード
     */
    @Transactional
    public void updatePassword(String email, String currentPassword, String newPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        // Issue#81 Phase 4e: OAuth のみユーザー (password_hash == null) は updatePassword 不可。
        // setInitialPassword を使うよう案内する専用エラー。
        if (user.getPasswordHash() == null) {
            throw new UnauthorizedException("パスワード未設定のアカウントです。初回パスワード設定を使用してください。");
        }

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new UnauthorizedException("現在のパスワードが正しくありません");
        }

        String hashedPassword = passwordEncoder.encode(newPassword);
        user.setPasswordHash(hashedPassword);
        userRepository.save(user);

        sendPasswordChangedNotification(email, user.getUsername(), user.getLanguage());
    }

    /**
     * パスワード変更完了の通知メールを送信
     */
    private void sendPasswordChangedNotification(String email, String username, String language) {
        try {
            if ("en".equals(language)) {
                emailService.send(
                        email,
                        "【Photlas】Password Changed",
                        "Hi " + (username != null ? username : "") + ",\n\n" +
                        "Your account password has been changed.\n\n" +
                        "If you did not make this change, please contact us immediately at:\n" +
                        "support@photlas.jp\n\n" +
                        "Photlas Team\nsupport@photlas.jp");
            } else {
                emailService.send(
                        email,
                        "【Photlas】パスワードが変更されました",
                        (username != null ? username : "") + " 様\n\n" +
                        "お客様のアカウントのパスワードが変更されました。\n\n" +
                        "この変更に心当たりがない場合は、至急以下のメールアドレスまでご連絡ください。\n" +
                        "support@photlas.jp\n\n" +
                        "Photlas 運営\nsupport@photlas.jp");
            }
        } catch (Exception e) {
            logger.error("パスワード変更通知メールの送信に失敗しました: {}", e.getMessage());
        }
    }

    /**
     * パスワードリセットメールを送信
     */
    private void sendPasswordResetEmail(String email, String token, String language) {
        try {
            String link = frontendUrl + "/reset-password?token=" + token;

            if ("en".equals(language)) {
                emailService.send(
                        email,
                        "【Photlas】Password Reset",
                        "We received a request to reset your password.\n\n" +
                        "Please click the link below to reset your password:\n" +
                        link + "\n\n" +
                        "This link will expire in 30 minutes.\n\n" +
                        "If you did not request this, please ignore this email.\n\n" +
                        "Photlas Team\nsupport@photlas.jp");
            } else {
                emailService.send(
                        email,
                        "【Photlas】パスワードの再設定",
                        "パスワード再設定のリクエストを受け付けました。\n\n" +
                        "以下のリンクをクリックして、パスワードを再設定してください：\n" +
                        link + "\n\n" +
                        "このリンクの有効期限は30分です。\n\n" +
                        "このメールに心当たりがない場合は、このメールを無視してください。\n\n" +
                        "Photlas 運営\nsupport@photlas.jp");
            }
        } catch (Exception e) {
            logger.error("パスワードリセットメールの送信に失敗しました: {}", e.getMessage());
        }
    }
}
