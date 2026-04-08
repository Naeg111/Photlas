package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.EmailChangeToken;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.repository.EmailChangeTokenRepository;
import com.photlas.backend.repository.EmailVerificationTokenRepository;
import com.photlas.backend.repository.PasswordResetTokenRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.util.TokenGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * アカウントサービス
 * メールアドレス変更、アカウント削除のビジネスロジックを提供する。
 */
@Service
public class AccountService {

    private static final Logger logger = LoggerFactory.getLogger(AccountService.class);
    private static final String ERROR_USER_NOT_FOUND = "ユーザーが見つかりません";
    private static final int EMAIL_CHANGE_TOKEN_EXPIRATION_MINUTES = 30;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SpotRepository spotRepository;
    private final PhotoRepository photoRepository;
    private final EmailChangeTokenRepository emailChangeTokenRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailService emailService;
    private final JwtService jwtService;

    @Value("${app.frontend-url:https://photlas.jp}")
    private String frontendUrl;

    public AccountService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            SpotRepository spotRepository,
            PhotoRepository photoRepository,
            EmailChangeTokenRepository emailChangeTokenRepository,
            EmailVerificationTokenRepository emailVerificationTokenRepository,
            PasswordResetTokenRepository passwordResetTokenRepository,
            EmailService emailService,
            JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.spotRepository = spotRepository;
        this.photoRepository = photoRepository;
        this.emailChangeTokenRepository = emailChangeTokenRepository;
        this.emailVerificationTokenRepository = emailVerificationTokenRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.emailService = emailService;
        this.jwtService = jwtService;
    }

    /**
     * Issue#86: メールアドレス変更リクエスト
     * 即座に変更せず、新メールアドレスに確認リンクを送信する。
     */
    @Transactional
    public void requestEmailChange(String email, String newEmail, String currentPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new UnauthorizedException("パスワードが正しくありません");
        }

        String normalizedNewEmail = newEmail.toLowerCase();
        if (email.equals(normalizedNewEmail)) {
            throw new IllegalArgumentException("現在のメールアドレスと同じです");
        }

        Optional<User> existingUser = userRepository.findByEmail(normalizedNewEmail);
        if (existingUser.isPresent() && !existingUser.get().getId().equals(user.getId())) {
            throw new ConflictException("このメールアドレスはすでに使用されています");
        }

        // 既存トークンを削除して新規作成
        emailChangeTokenRepository.findByUserId(user.getId()).ifPresent(
                t -> emailChangeTokenRepository.delete(t)
        );

        String token = TokenGenerator.generateSecureToken();
        Date expiryDate = new Date(System.currentTimeMillis()
                + EMAIL_CHANGE_TOKEN_EXPIRATION_MINUTES * 60 * 1000);

        EmailChangeToken changeToken = new EmailChangeToken(
                user.getId(), normalizedNewEmail, token, expiryDate);
        emailChangeTokenRepository.save(changeToken);

        // 新メールアドレスに確認リンクを送信
        emailService.send(
                normalizedNewEmail,
                "【Photlas】メールアドレス変更の確認",
                user.getUsername() + " さん\n\n" +
                "メールアドレスの変更リクエストを受け付けました。\n" +
                "以下のリンクをクリックして、変更を確定してください：\n\n" +
                frontendUrl + "/confirm-email-change?token=" + token + "\n\n" +
                "このリンクの有効期限は30分です。\n\n" +
                "このメールに心当たりがない場合は、このメールを無視してください。\n\n" +
                "Photlas チーム");

        // 旧メールアドレスに通知
        try {
            emailService.send(
                    email,
                    "【Photlas】メールアドレスの変更がリクエストされました",
                    user.getUsername() + " さん\n\n" +
                    "お客様のアカウントでメールアドレスの変更がリクエストされました。\n\n" +
                    "心当たりがない場合は、ただちにパスワードを変更してください。\n\n" +
                    "Photlas チーム");
        } catch (Exception e) {
            logger.error("Failed to send email change notification to old address: {}", e.getMessage());
        }
    }

    /**
     * Issue#86: メールアドレス変更確認
     * トークンを検証し、メールアドレスを更新してJWTを再発行する。
     *
     * @return 新メールアドレスベースのJWTと新メールアドレス
     */
    @Transactional
    public EmailChangeResult confirmEmailChange(String token) {
        Optional<EmailChangeToken> tokenOptional = emailChangeTokenRepository.findByToken(token);
        if (tokenOptional.isEmpty()) {
            throw new IllegalArgumentException("トークンが無効または期限切れです");
        }

        EmailChangeToken changeToken = tokenOptional.get();

        if (changeToken.getExpiryDate().before(new Date())) {
            emailChangeTokenRepository.delete(changeToken);
            throw new IllegalArgumentException("トークンが無効または期限切れです");
        }

        // 新メールアドレスの重複チェック（リクエスト〜確認の間に別ユーザーが登録した場合に備える）
        Optional<User> existingUser = userRepository.findByEmail(changeToken.getNewEmail());
        if (existingUser.isPresent() && !existingUser.get().getId().equals(changeToken.getUserId())) {
            emailChangeTokenRepository.delete(changeToken);
            throw new ConflictException("このメールアドレスはすでに使用されています");
        }

        User user = userRepository.findById(changeToken.getUserId())
                .orElseThrow(() -> new IllegalArgumentException(ERROR_USER_NOT_FOUND));

        user.setEmail(changeToken.getNewEmail());
        userRepository.save(user);

        emailChangeTokenRepository.delete(changeToken);

        String newJwt = jwtService.generateTokenWithRole(user.getEmail(), CodeConstants.roleToJwtString(user.getRole()));

        return new EmailChangeResult(newJwt, user.getEmail());
    }

    /**
     * メールアドレス変更確認の結果
     */
    public record EmailChangeResult(String token, String email) {}

    /**
     * アカウント削除 - ソフトデリート
     */
    @Transactional
    public void deleteAccount(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new UnauthorizedException("パスワードが正しくありません");
        }

        transferSpotOwnership(user);

        // 関連トークンを削除
        emailVerificationTokenRepository.deleteByUserId(user.getId());
        passwordResetTokenRepository.findByUserId(user.getId()).ifPresent(
                t -> passwordResetTokenRepository.delete(t));
        emailChangeTokenRepository.findByUserId(user.getId()).ifPresent(
                t -> emailChangeTokenRepository.delete(t));

        String originalUsername = user.getUsername();
        user.setOriginalUsername(originalUsername);
        user.setUsername("d_" + UUID.randomUUID().toString().substring(0, 10));

        user.setDeletedAt(java.time.LocalDateTime.now());
        userRepository.save(user);

        sendAccountDeletionConfirmation(email, originalUsername);
    }

    /**
     * アカウント削除確認メールを送信する
     */
    private void sendAccountDeletionConfirmation(String email, String username) {
        try {
            emailService.send(
                    email,
                    "【Photlas】アカウント削除のご確認",
                    username + " さん\n\n" +
                    "アカウントの削除が完了しました。\n\n" +
                    "お客様のデータは90日間保持されます。90日経過後、すべてのデータが完全に削除されます。\n\n" +
                    "この操作に心当たりがない場合は、至急以下までご連絡ください。\n" +
                    "support@photlas.jp\n\n" +
                    "Photlas 運営\nsupport@photlas.jp");
        } catch (Exception e) {
            logger.error("アカウント削除確認メールの送信に失敗しました: {}", e.getMessage());
        }
    }

    private void transferSpotOwnership(User deletingUser) {
        List<Spot> ownedSpots = spotRepository.findByCreatedByUserId(deletingUser.getId());
        for (Spot spot : ownedSpots) {
            Optional<User> nextOwner = photoRepository
                    .findOldestActiveUserBySpotExcluding(spot.getSpotId(), deletingUser.getId());
            nextOwner.ifPresent(owner -> spot.setCreatedByUserId(owner.getId()));
        }
    }
}
