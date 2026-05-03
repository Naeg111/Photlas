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
import com.photlas.backend.exception.ForbiddenException;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.util.SecurityAuditLogger;
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
    private final EmailTemplateService emailTemplateService;
    private final JwtService jwtService;
    private final UserOAuthConnectionRepository userOAuthConnectionRepository;
    /**
     * Hotfix: OAuth 無効時は {@link OAuthTokenRevokeService} が Bean として生成されないため、
     * {@link ObjectProvider} で optional 注入し、OAuth 有効時のみ revoke を呼ぶ。
     */
    private final ObjectProvider<OAuthTokenRevokeService> oauthTokenRevokeServiceProvider;
    /** Issue#104: cancel-registration の監査ログ記録用 */
    private final SecurityAuditLogger securityAuditLogger;

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
            EmailTemplateService emailTemplateService,
            JwtService jwtService,
            UserOAuthConnectionRepository userOAuthConnectionRepository,
            ObjectProvider<OAuthTokenRevokeService> oauthTokenRevokeServiceProvider,
            SecurityAuditLogger securityAuditLogger) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.spotRepository = spotRepository;
        this.photoRepository = photoRepository;
        this.emailChangeTokenRepository = emailChangeTokenRepository;
        this.emailVerificationTokenRepository = emailVerificationTokenRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.emailService = emailService;
        this.emailTemplateService = emailTemplateService;
        this.jwtService = jwtService;
        this.userOAuthConnectionRepository = userOAuthConnectionRepository;
        this.oauthTokenRevokeServiceProvider = oauthTokenRevokeServiceProvider;
        this.securityAuditLogger = securityAuditLogger;
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

        // Issue#113 §4.5 A-1: 旧アドレス（アラート）を先に送信し、新アドレス（リンク）を後に送信する。
        // 両方ともグループ A（失敗時 500）。@Transactional により、どちらか失敗すれば
        // emailChangeToken も含めてロールバックされる。
        String oldSubject = emailTemplateService.subject("email.emailChangeNotifyOld", user);
        String oldBody = emailTemplateService.body("email.emailChangeNotifyOld", user, user.getUsername());
        emailService.send(email, oldSubject, oldBody);

        String link = frontendUrl + "/confirm-email-change?token=" + token;
        String newSubject = emailTemplateService.subject("email.emailChangeConfirm", user);
        String newBody = emailTemplateService.body("email.emailChangeConfirm", user, user.getUsername(), link);
        emailService.send(normalizedNewEmail, newSubject, newBody);
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
     * Issue#104: 同意ダイアログでキャンセルされた未同意 OAuth アカウントを物理削除する。
     *
     * <p>処理順序：
     * <ol>
     *   <li>{@code terms_agreed_at IS NULL} チェック → 違反なら 403 例外</li>
     *   <li>OAuth トークン revoke を best-effort で実行（user_oauth_connections を参照するため、削除前に行う）</li>
     *   <li>users レコードを物理削除（user_oauth_connections は CASCADE で自動削除：V23 マイグレーション）</li>
     *   <li>SecurityAuditLogger に OAUTH_ACCOUNT_CANCELLED イベントを記録</li>
     * </ol>
     *
     * @param email キャンセル対象ユーザーのメールアドレス
     */
    @Transactional
    public void cancelRegistration(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        // 安全策: 同意済みユーザーは削除しない（誤呼び出し防止）
        if (user.getTermsAgreedAt() != null || user.getPrivacyPolicyAgreedAt() != null) {
            throw new ForbiddenException("同意済みのユーザーは登録キャンセル操作を実行できません");
        }

        Long userId = user.getId();

        // OAuth トークン revoke を先に実行（user_oauth_connections を参照するため、削除前）
        OAuthTokenRevokeService revokeService = oauthTokenRevokeServiceProvider.getIfAvailable();
        if (revokeService != null) {
            revokeService.revokeForUser(userId);
        }

        // user_oauth_connections を明示的に削除（DB の ON DELETE CASCADE もあるが、
        // @Transactional テスト等では CASCADE がトランザクションコミット前に効かないため明示削除する）
        userOAuthConnectionRepository.deleteByUserId(userId);

        // users を物理削除（テスト等のトランザクション内検証で確実に反映するため flush する）
        userRepository.delete(user);
        userRepository.flush();

        // 監査ログ
        java.util.LinkedHashMap<String, Object> fields = new java.util.LinkedHashMap<>();
        fields.put("user_id", userId);
        securityAuditLogger.log(SecurityAuditLogger.Event.OAUTH_ACCOUNT_CANCELLED, fields);
    }

    /**
     * Issue#81 Phase 4d / Issue#113 フェーズ 3: アカウント削除確認メールを送信。
     *
     * <p>ユーザー区分（NORMAL / OAUTH_ONLY / HYBRID）に応じて 3 サブキーを使い分け、
     * 5 言語の properties から件名・本文を取得する。グループ C のため、メール送信
     * 失敗時も削除処理は完了扱い（WARN ログのみ）。</p>
     */
    private void sendAccountDeletionConfirmation(User user, String originalUsername) {
        DeletionTemplate template = resolveDeletionTemplate(user);
        String providerName = template == DeletionTemplate.NORMAL ? null : resolveProviderName(user);
        String key = switch (template) {
            case NORMAL     -> "email.accountDeletion.normal";
            case OAUTH_ONLY -> "email.accountDeletion.oauthOnly";
            case HYBRID     -> "email.accountDeletion.hybrid";
        };

        try {
            String subject = emailTemplateService.subject(key, user);
            String body = template == DeletionTemplate.NORMAL
                    ? emailTemplateService.body(key, user, originalUsername)
                    : emailTemplateService.body(key, user, originalUsername, providerName);
            emailService.send(user.getEmail(), subject, body);
        } catch (Exception e) {
            logger.warn("アカウント削除確認メールの送信に失敗しました: userId={} error={}",
                    user.getId(), e.getMessage());
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

    private void transferSpotOwnership(User deletingUser) {
        List<Spot> ownedSpots = spotRepository.findByCreatedByUserId(deletingUser.getId());
        for (Spot spot : ownedSpots) {
            Optional<User> nextOwner = photoRepository
                    .findOldestActiveUserBySpotExcluding(spot.getSpotId(), deletingUser.getId());
            nextOwner.ifPresent(owner -> spot.setCreatedByUserId(owner.getId()));
        }
    }
}
