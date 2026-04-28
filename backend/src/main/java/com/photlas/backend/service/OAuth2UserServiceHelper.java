package com.photlas.backend.service;

import com.photlas.backend.dto.OAuth2UserInfo;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.security.OAuth2LinkConfirmationException;
import com.photlas.backend.util.OAuthTokenEncryptor;
import com.photlas.backend.util.SecurityAuditLogger;
import com.photlas.backend.util.TemporaryUsernameGenerator;
import com.photlas.backend.validation.LanguageValidator;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * Issue#81 Phase 3b / Issue#99 - OAuth コアロジック（プロバイダーをモック可能な単体テスト対象）。
 *
 * {@code CustomOAuth2UserService}（Spring Security の認証チェーンから呼ばれる）から委譲される。
 * 技術設計書 3.3 / 3.28 / 3.29 / 3.31 / 3.40 を参照。
 *
 * <p>処理フロー:
 * <ol>
 *   <li>(provider, provider_user_id) で既存 OAuth 接続を検索 → ログイン or ステータスチェック</li>
 *   <li>email で既存ユーザーを検索
 *     <ul>
 *       <li>{@code email_verified=false} → {@code OAUTH_EMAIL_VERIFICATION_REQUIRED}</li>
 *       <li>role=ADMIN → {@code OAUTH_ADMIN_NOT_ALLOWED}</li>
 *       <li>{@code email_verified=true} かつ非管理者 → {@link OAuthLinkConfirmationService#issue}
 *           で短命トークンを発行し {@link com.photlas.backend.security.OAuth2LinkConfirmationException}
 *           を投げる（リンク確認フロー）</li>
 *     </ul>
 *   </li>
 *   <li>どちらも見つからない場合: 新規ユーザー作成（仮ユーザー名、{@code usernameTemporary=true}, {@code passwordHash=null}）</li>
 * </ol>
 *
 * <p>ステータスチェック: SUSPENDED は拒否、ソフトデリート済みは {@code AuthService#recoverSoftDeletedUser} で復旧。
 * レース条件: {@code DataIntegrityViolationException} をキャッチして {@code findByEmail} 再検索。
 * 全体は {@code @Transactional(rollbackFor = Exception.class)} でラップ。
 *
 * <p>Issue#99 で {@link OAuthLinkConfirmationService} を統合済み。リンク確認が必要な場合は短命トークンを
 * 発行し {@link com.photlas.backend.security.OAuth2LinkConfirmationException} を投げる。
 * {@link com.photlas.backend.security.OAuth2LoginFailureHandler} がこの例外型を検出して
 * {@code #link_confirmation_token=...} 形式でフロントエンドにリダイレクトする。
 * 実際の {@code UserOAuthConnection} 作成は、ユーザーが確認ダイアログで「連携する」を押した後の
 * {@code POST /api/v1/auth/oauth2/confirm-link}（{@code OAuthLinkConfirmationService.consume}）で行われる。
 */
@Service
@ConditionalOnProperty(name = "photlas.oauth.enabled", havingValue = "true")
public class OAuth2UserServiceHelper {

    private final UserRepository userRepository;
    private final UserOAuthConnectionRepository userOAuthConnectionRepository;
    private final AuthService authService;
    private final OAuthTokenEncryptor oauthTokenEncryptor;
    private final SecurityAuditLogger securityAuditLogger;
    private final OAuthLinkConfirmationService oauthLinkConfirmationService;

    public OAuth2UserServiceHelper(
            UserRepository userRepository,
            UserOAuthConnectionRepository userOAuthConnectionRepository,
            AuthService authService,
            OAuthTokenEncryptor oauthTokenEncryptor,
            SecurityAuditLogger securityAuditLogger,
            OAuthLinkConfirmationService oauthLinkConfirmationService) {
        this.userRepository = userRepository;
        this.userOAuthConnectionRepository = userOAuthConnectionRepository;
        this.authService = authService;
        this.oauthTokenEncryptor = oauthTokenEncryptor;
        this.securityAuditLogger = securityAuditLogger;
        this.oauthLinkConfirmationService = oauthLinkConfirmationService;
    }

    /**
     * OAuth 認証完了後のユーザー特定・作成・復旧処理を行う。
     *
     * @param info 正規化済み OAuth ユーザー情報
     * @return ログイン可能な User
     * @throws OAuth2AuthenticationException SUSPENDED / ADMIN / EMAIL_VERIFICATION_REQUIRED /
     *                                       EMAIL_REQUIRED / LINK_CONFIRMATION_REQUIRED などの各種拒否
     */
    @Transactional(rollbackFor = Exception.class)
    public User processOAuthUser(OAuth2UserInfo info) {
        validateRequired(info);

        OAuthProvider provider = info.provider();
        String providerUserId = info.providerUserId();
        String email = info.email().toLowerCase();

        // 1. (provider, provider_user_id) で既存 OAuth 接続を検索
        Optional<UserOAuthConnection> existingConnection =
                userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(
                        provider.getCode(), providerUserId);

        if (existingConnection.isPresent()) {
            User user = userRepository.findById(existingConnection.get().getUserId())
                    .orElseThrow(() -> authException("OAUTH_USER_NOT_FOUND",
                            "OAuth 接続に紐づく User が存在しません"));
            return handleExistingOAuthUser(user, provider);
        }

        // 2. email で既存ユーザーを検索（リンク確認フロー or 拒否）
        Optional<User> existingByEmail = userRepository.findByEmail(email);
        if (existingByEmail.isPresent()) {
            return handleExistingEmailMatch(existingByEmail.get(), info, email);
        }

        // 3. 新規ユーザー作成
        return createNewUserWithOAuthConnection(info, email);
    }

    // ---------- 入力バリデーション ----------

    private void validateRequired(OAuth2UserInfo info) {
        if (info.email() == null || info.email().isBlank()) {
            throw authException("OAUTH_EMAIL_REQUIRED", "OAuth プロバイダから email を取得できませんでした");
        }
        if (info.providerUserId() == null || info.providerUserId().isBlank()) {
            throw authException("OAUTH_PROVIDER_USER_ID_REQUIRED",
                    "OAuth プロバイダから providerUserId を取得できませんでした");
        }
        if (info.provider() == null) {
            throw authException("OAUTH_PROVIDER_REQUIRED", "OAuth プロバイダが不明です");
        }
    }

    // ---------- 既存 OAuth ユーザーのログイン ----------

    private User handleExistingOAuthUser(User user, OAuthProvider provider) {
        // SUSPENDED 拒否
        if (Integer.valueOf(CodeConstants.ROLE_SUSPENDED).equals(user.getRole())) {
            securityAuditLogger.logWarn(SecurityAuditLogger.Event.OAUTH_LOGIN_FAILED,
                    auditFields(user.getId(), provider, "reason", "USER_SUSPENDED"));
            throw authException("USER_SUSPENDED", "アカウントが停止されています");
        }

        // ソフトデリート済み → 復旧
        if (user.getDeletedAt() != null) {
            authService.recoverSoftDeletedUser(user);
            securityAuditLogger.log(SecurityAuditLogger.Event.OAUTH_ACCOUNT_RECOVERED,
                    auditFields(user.getId(), provider));
        }

        securityAuditLogger.log(SecurityAuditLogger.Event.OAUTH_LOGIN_SUCCESS,
                auditFields(user.getId(), provider));
        return user;
    }

    // ---------- メール一致の分岐 ----------

    private User handleExistingEmailMatch(User user, OAuth2UserInfo info, String email) {
        OAuthProvider provider = info.provider();
        if (!user.isEmailVerified()) {
            securityAuditLogger.logWarn(SecurityAuditLogger.Event.OAUTH_LOGIN_FAILED,
                    auditFields(user.getId(), provider, "reason", "OAUTH_EMAIL_VERIFICATION_REQUIRED"));
            throw authException("OAUTH_EMAIL_VERIFICATION_REQUIRED",
                    "メール認証が完了していないアカウントは OAuth 連携できません");
        }
        if (Integer.valueOf(CodeConstants.ROLE_ADMIN).equals(user.getRole())) {
            securityAuditLogger.logWarn(SecurityAuditLogger.Event.OAUTH_LOGIN_FAILED,
                    auditFields(user.getId(), provider, "reason", "OAUTH_ADMIN_NOT_ALLOWED"));
            throw authException("OAUTH_ADMIN_NOT_ALLOWED",
                    "管理者アカウントは SNS ログインで利用できません");
        }
        // Issue#99: OAuthLinkConfirmationService で短命トークンを発行し、
        // 失敗ハンドラ経由でフロントエンドにトークンを渡す。フロントエンドは
        // 確認ダイアログでユーザーの同意を得てから confirm-link API を呼んで
        // UserOAuthConnection を作成する（consume() 側で INSERT）。
        String token = oauthLinkConfirmationService.issue(
                user.getId(), provider, info.providerUserId(), email);
        securityAuditLogger.log(SecurityAuditLogger.Event.OAUTH_LINK_REJECTED,
                auditFields(user.getId(), provider, "reason", "LINK_CONFIRMATION_REQUIRED"));
        throw new OAuth2LinkConfirmationException(token, provider);
    }

    // ---------- 新規ユーザー作成（+ レース条件対応） ----------

    private User createNewUserWithOAuthConnection(OAuth2UserInfo info, String email) {
        String language = LanguageValidator.sanitize(info.language());

        try {
            User newUser = new User(
                    TemporaryUsernameGenerator.generate(),
                    email,
                    null,                                   // OAuth のみ: passwordHash=null
                    CodeConstants.ROLE_USER
            );
            newUser.setEmailVerified(true);
            newUser.setUsernameTemporary(true);
            newUser.setLanguage(language);

            User saved = userRepository.save(newUser);
            linkOAuthConnection(saved, info);

            securityAuditLogger.log(SecurityAuditLogger.Event.OAUTH_ACCOUNT_CREATED,
                    auditFields(saved.getId(), info.provider()));
            return saved;
        } catch (DataIntegrityViolationException e) {
            // レース: 別タブが先に INSERT した → 再検索して紐付けだけ行う
            User existing = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalStateException(
                            "race condition: expected user not found after UNIQUE violation", e));
            if (userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(
                    info.provider().getCode(), info.providerUserId()).isEmpty()) {
                linkOAuthConnection(existing, info);
            }
            securityAuditLogger.log(SecurityAuditLogger.Event.OAUTH_ACCOUNT_CREATED,
                    auditFields(existing.getId(), info.provider(), "race", "recovered"));
            return existing;
        }
    }

    private void linkOAuthConnection(User user, OAuth2UserInfo info) {
        UserOAuthConnection connection = new UserOAuthConnection();
        connection.setUserId(user.getId());
        connection.setProviderCode(info.provider().getCode());
        connection.setProviderUserId(info.providerUserId());
        connection.setEmail(info.email() != null ? info.email().toLowerCase() : null);
        connection.setEmailVerified(Boolean.TRUE);

        if (info.accessToken() != null && !info.accessToken().isBlank()) {
            OAuthTokenEncryptor.Encrypted encrypted = oauthTokenEncryptor.encrypt(info.accessToken());
            if (encrypted != null) {
                connection.setAccessTokenEncrypted(encrypted.ciphertext());
                connection.setTokenEncryptedIv(encrypted.iv());
            }
        }
        connection.setTokenExpiresAt(info.tokenExpiresAt());

        userOAuthConnectionRepository.save(connection);
    }

    // ---------- 例外・監査ログのユーティリティ ----------

    private OAuth2AuthenticationException authException(String errorCode, String description) {
        // message = errorCode とすることで OAuth2LoginFailureHandler がエラーコードを
        // フラグメントにリダイレクトしやすくする（3.16 / 3.29 のエラーコード連携前提）。
        return new OAuth2AuthenticationException(
                new OAuth2Error(errorCode, description, null),
                errorCode
        );
    }

    private Map<String, Object> auditFields(Long userId, OAuthProvider provider, Object... extra) {
        Map<String, Object> fields = new LinkedHashMap<>();
        if (userId != null) {
            fields.put("user_id", userId);
        }
        if (provider != null) {
            fields.put("provider", provider.name());
        }
        for (int i = 0; i + 1 < extra.length; i += 2) {
            fields.put(String.valueOf(extra[i]), extra[i + 1]);
        }
        return fields;
    }
}
