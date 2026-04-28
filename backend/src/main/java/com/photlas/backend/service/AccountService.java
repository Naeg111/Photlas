package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.EmailChangeToken;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.repository.EmailChangeTokenRepository;
import com.photlas.backend.repository.EmailVerificationTokenRepository;
import com.photlas.backend.repository.PasswordResetTokenRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.util.TokenGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final UserOAuthConnectionRepository userOAuthConnectionRepository;
    /**
     * Hotfix: OAuth 無効時は {@link OAuthTokenRevokeService} が Bean として生成されないため、
     * {@link ObjectProvider} で optional 注入し、OAuth 有効時のみ revoke を呼ぶ。
     */
    private final ObjectProvider<OAuthTokenRevokeService> oauthTokenRevokeServiceProvider;

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
            JwtService jwtService,
            UserOAuthConnectionRepository userOAuthConnectionRepository,
            ObjectProvider<OAuthTokenRevokeService> oauthTokenRevokeServiceProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.spotRepository = spotRepository;
        this.photoRepository = photoRepository;
        this.emailChangeTokenRepository = emailChangeTokenRepository;
        this.emailVerificationTokenRepository = emailVerificationTokenRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.emailService = emailService;
        this.jwtService = jwtService;
        this.userOAuthConnectionRepository = userOAuthConnectionRepository;
        this.oauthTokenRevokeServiceProvider = oauthTokenRevokeServiceProvider;
    }

    /**
     * Issue#86: メールアドレス変更リクエスト
     * 即座に変更せず、新メールアドレスに確認リンクを送信する。
     */
    @Transactional
    public void requestEmailChange(String email, String newEmail, String currentPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        // Issue#81 Phase 4h: OAuth のみユーザー (password_hash == null) はメールアドレス変更不可
        // （email はプロバイダとの紐付けに使われるため、Photlas 側だけで変更すると不整合を起こす）
        if (user.getPasswordHash() == null) {
            throw new UnauthorizedException("OAuth 連携アカウントはメールアドレスを変更できません");
        }

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
        String link = frontendUrl + "/confirm-email-change?token=" + token;
        if ("en".equals(user.getLanguage())) {
            emailService.send(
                    normalizedNewEmail,
                    "【Photlas】Email Change Confirmation",
                    "Hi " + user.getUsername() + ",\n\n" +
                    "We received a request to change your email address.\n" +
                    "Please click the link below to confirm the change:\n\n" +
                    link + "\n\n" +
                    "This link will expire in 30 minutes.\n\n" +
                    "If you did not request this, please ignore this email.\n\n" +
                    "Photlas Team");
        } else {
            emailService.send(
                    normalizedNewEmail,
                    "【Photlas】メールアドレス変更の確認",
                    user.getUsername() + " さん\n\n" +
                    "メールアドレスの変更リクエストを受け付けました。\n" +
                    "以下のリンクをクリックして、変更を確定してください：\n\n" +
                    link + "\n\n" +
                    "このリンクの有効期限は30分です。\n\n" +
                    "このメールに心当たりがない場合は、このメールを無視してください。\n\n" +
                    "Photlas 運営");
        }

        // 旧メールアドレスに通知
        try {
            if ("en".equals(user.getLanguage())) {
                emailService.send(
                        email,
                        "【Photlas】Email Change Requested",
                        "Hi " + user.getUsername() + ",\n\n" +
                        "An email address change has been requested for your account.\n\n" +
                        "If you did not make this request, please change your password immediately.\n\n" +
                        "Photlas Team");
            } else {
                emailService.send(
                        email,
                        "【Photlas】メールアドレスの変更がリクエストされました",
                        user.getUsername() + " さん\n\n" +
                        "お客様のアカウントでメールアドレスの変更がリクエストされました。\n\n" +
                        "心当たりがない場合は、ただちにパスワードを変更してください。\n\n" +
                        "Photlas 運営");
            }
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
     *
     * <p>Issue#81 Phase 4b で 3 引数化。通常 / ハイブリッドユーザー (password_hash != null) は
     * {@code password} の照合、OAuth のみユーザー (password_hash == null) は
     * {@code confirmationChecked == true} の確認のみで削除する。
     *
     * <p>クラスレベルの整合性（OAuth のみユーザーは password=null かつ confirmationChecked=true
     * である等）は {@code @ValidDeleteAccountRequest} が事前に検証するため、ここでは
     * password_hash の有無だけで分岐する。
     *
     * @param email              削除対象ユーザーのメールアドレス
     * @param password           通常 / ハイブリッドユーザーのパスワード（OAuth のみユーザーは null）
     * @param confirmationChecked OAuth のみユーザーの退会チェックボックス状態
     */
    @Transactional
    public void deleteAccount(String email, String password, boolean confirmationChecked) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        if (user.getPasswordHash() != null) {
            // 通常 / ハイブリッドユーザー: パスワード検証必須
            if (!passwordEncoder.matches(password, user.getPasswordHash())) {
                throw new UnauthorizedException("パスワードが正しくありません");
            }
        } else {
            // OAuth のみユーザー: confirmationChecked=true 必須
            // （通常は Validator で弾かれているが、サービス層の契約として明示的に検査）
            if (!confirmationChecked) {
                throw new UnauthorizedException("退会確認がされていません");
            }
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

        // Issue#81 Phase 4d: 退会後に OAuth access_token の revoke を非同期で試みる（best-effort）
        // Hotfix: OAuth 無効時は Bean が不在のため ObjectProvider.ifAvailable で skip
        OAuthTokenRevokeService revokeService = oauthTokenRevokeServiceProvider.getIfAvailable();
        if (revokeService != null) {
            revokeService.revokeForUser(user.getId());
        }

        sendAccountDeletionConfirmation(user, originalUsername);
    }

    /**
     * Issue#81 Phase 4d: アカウント削除確認メール送信のオーケストレータ（3 段階リファクタ）。
     *
     * <p>(1) ユーザー区分を解決 → (2) プロバイダ名を解決 → (3) 本文組み立て → (4) 送信。
     */
    private void sendAccountDeletionConfirmation(User user, String originalUsername) {
        DeletionTemplate template = resolveDeletionTemplate(user);
        String providerName = template == DeletionTemplate.NORMAL ? null : resolveProviderName(user);
        String language = user.getLanguage();

        String subject = "en".equals(language)
                ? "【Photlas】Account Deletion Confirmation"
                : "【Photlas】アカウント削除のご確認";
        String body = buildDeletionEmailBody(template, language, originalUsername, providerName);

        try {
            emailService.send(user.getEmail(), subject, body);
        } catch (Exception e) {
            logger.error("アカウント削除確認メールの送信に失敗しました: {}", e.getMessage());
        }
    }

    /**
     * ユーザーのアカウント構成からテンプレート区分を決定する。
     *
     * <p>password_hash と {@link UserOAuthConnectionRepository} の組み合わせで分岐:
     * <ul>
     *   <li>password_hash == null  → OAUTH_ONLY</li>
     *   <li>password_hash != null かつ OAuth 連携あり → HYBRID</li>
     *   <li>それ以外（password_hash != null かつ OAuth 連携なし） → NORMAL</li>
     * </ul>
     */
    private DeletionTemplate resolveDeletionTemplate(User user) {
        if (user.getPasswordHash() == null) {
            return DeletionTemplate.OAUTH_ONLY;
        }
        List<UserOAuthConnection> connections = userOAuthConnectionRepository.findByUserId(user.getId());
        return connections.isEmpty() ? DeletionTemplate.NORMAL : DeletionTemplate.HYBRID;
    }

    /**
     * ユーザーに紐づく OAuth プロバイダ名を決定する。
     * <p>1 連携なら "Google" / "LINE"、複数連携なら "Google / LINE"。
     * NORMAL ユーザー向けには呼び出されない前提。
     */
    private String resolveProviderName(User user) {
        List<UserOAuthConnection> connections = userOAuthConnectionRepository.findByUserId(user.getId());
        return connections.stream()
                .map(c -> displayNameOf(c.getProviderCode()))
                .distinct()
                .collect(Collectors.joining(" / "));
    }

    private static String displayNameOf(Integer providerCode) {
        if (providerCode == null) {
            return "";
        }
        OAuthProvider p = OAuthProvider.fromCode(providerCode);
        return switch (p) {
            case GOOGLE -> "Google";
            case LINE -> "LINE";
        };
    }

    /**
     * 純関数: テンプレート区分 × 言語で本文を組み立てる。DB アクセス・SecurityContext 参照を行わない。
     *
     * @param template     ユーザー区分
     * @param language     "en" 以外は ja 扱い
     * @param username     元の表示名（宛名に使用）
     * @param providerName プロバイダ名（OAUTH_ONLY / HYBRID 時のみ使用、NORMAL では null 可）
     */
    private static String buildDeletionEmailBody(
            DeletionTemplate template, String language, String username, String providerName) {
        boolean en = "en".equals(language);
        return switch (template) {
            case NORMAL -> en ? normalBodyEn(username) : normalBodyJa(username);
            case HYBRID -> en ? hybridBodyEn(username, providerName) : hybridBodyJa(username, providerName);
            case OAUTH_ONLY -> en ? oauthOnlyBodyEn(username, providerName) : oauthOnlyBodyJa(username, providerName);
        };
    }

    // ---- NORMAL: 既存文面を一字一句保持（ゴールデンテストで検証）----

    private static String normalBodyJa(String username) {
        return username + " さん\n\n" +
                "アカウントの削除が完了しました。\n\n" +
                "お客様のデータは90日間保持されます。90日経過後、すべてのデータが完全に削除されます。\n\n" +
                "アカウントを復旧したい場合は、90日以内にメールアドレスとパスワードでログインしてください。\n\n" +
                "この操作に心当たりがない場合は、至急以下までご連絡ください。\n" +
                "support@photlas.jp\n\n" +
                "Photlas 運営\nsupport@photlas.jp";
    }

    private static String normalBodyEn(String username) {
        return "Hi " + username + ",\n\n" +
                "Your account has been deleted.\n\n" +
                "Your data will be retained for 90 days. After that, all data will be permanently deleted.\n\n" +
                "If you wish to restore your account, simply log in with your email and password within 90 days.\n\n" +
                "If you did not perform this action, please contact us immediately at:\n" +
                "support@photlas.jp\n\n" +
                "Photlas Team\nsupport@photlas.jp";
    }

    // ---- HYBRID: 「メールアドレスとパスワード」+「または {provider}」 ----

    private static String hybridBodyJa(String username, String providerName) {
        return username + " さん\n\n" +
                "アカウントの削除が完了しました。\n\n" +
                "お客様のデータは90日間保持されます。90日経過後、すべてのデータが完全に削除されます。\n\n" +
                "アカウントを復旧したい場合は、90日以内にメールアドレスとパスワード、または " + providerName + " で再度サインインしてください。\n\n" +
                "この操作に心当たりがない場合は、至急以下までご連絡ください。\n" +
                "support@photlas.jp\n\n" +
                "Photlas 運営\nsupport@photlas.jp";
    }

    private static String hybridBodyEn(String username, String providerName) {
        return "Hi " + username + ",\n\n" +
                "Your account has been deleted.\n\n" +
                "Your data will be retained for 90 days. After that, all data will be permanently deleted.\n\n" +
                "If you wish to restore your account, sign in with your email and password, or sign in with " + providerName + " within 90 days.\n\n" +
                "If you did not perform this action, please contact us immediately at:\n" +
                "support@photlas.jp\n\n" +
                "Photlas Team\nsupport@photlas.jp";
    }

    // ---- OAUTH_ONLY: プロバイダ再サインインのみ ----

    private static String oauthOnlyBodyJa(String username, String providerName) {
        return username + " さん\n\n" +
                "アカウントの削除が完了しました。\n\n" +
                "お客様のデータは90日間保持されます。90日経過後、すべてのデータが完全に削除されます。\n\n" +
                "アカウントを復旧したい場合は、90日以内に " + providerName + " で再度サインインしてください。\n\n" +
                "この操作に心当たりがない場合は、至急以下までご連絡ください。\n" +
                "support@photlas.jp\n\n" +
                "Photlas 運営\nsupport@photlas.jp";
    }

    private static String oauthOnlyBodyEn(String username, String providerName) {
        return "Hi " + username + ",\n\n" +
                "Your account has been deleted.\n\n" +
                "Your data will be retained for 90 days. After that, all data will be permanently deleted.\n\n" +
                "If you wish to restore your account, sign in with " + providerName + " within 90 days.\n\n" +
                "If you did not perform this action, please contact us immediately at:\n" +
                "support@photlas.jp\n\n" +
                "Photlas Team\nsupport@photlas.jp";
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
