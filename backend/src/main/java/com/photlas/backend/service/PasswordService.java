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
    private final EmailTemplateService emailTemplateService;

    @Value("${app.frontend-url:https://photlas.jp}")
    private String frontendUrl;

    public PasswordService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            PasswordResetTokenRepository passwordResetTokenRepository,
            EmailService emailService,
            EmailTemplateService emailTemplateService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.emailService = emailService;
        this.emailTemplateService = emailTemplateService;
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

        sendPasswordResetEmail(user, token);
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

        sendPasswordChangedNotification(user.getEmail(), user);
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

        sendPasswordChangedNotification(email, user);
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

        sendPasswordChangedNotification(email, user);
    }

    /**
     * Issue#113 グループ C: パスワード変更完了の通知メールを送信。
     * 失敗時は WARN ログのみで業務操作は成功扱い（ユーザーは新パスワードでログインできる状態）。
     */
    private void sendPasswordChangedNotification(String email, User user) {
        try {
            String subject = emailTemplateService.subject("email.passwordChanged", user);
            String body = emailTemplateService.body("email.passwordChanged", user,
                    user.getUsername() != null ? user.getUsername() : "");
            emailService.send(email, subject, body);
        } catch (Exception e) {
            logger.warn("パスワード変更通知メールの送信に失敗しました: userId={} error={}",
                    user.getId(), e.getMessage());
        }
    }

    /**
     * Issue#113 グループ A: パスワードリセットメールを送信。
     * 失敗時は例外を呼び出し元へ伝播し HTTP 500 にマップされる。
     */
    private void sendPasswordResetEmail(User user, String token) {
        String link = frontendUrl + "/reset-password?token=" + token;
        String subject = emailTemplateService.subject("email.passwordReset", user);
        String body = emailTemplateService.body("email.passwordReset", user, link);
        emailService.send(user.getEmail(), subject, body);
    }
}
