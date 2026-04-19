package com.photlas.backend.service;

import com.photlas.backend.dto.OAuth2UserInfo;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.util.OAuthTokenEncryptor;
import com.photlas.backend.util.SecurityAuditLogger;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issue#81 Phase 3b - OAuth コアロジック（プロバイダーモック可能な単体テスト対象）。
 *
 * {@code CustomOAuth2UserService}（Spring Security の認証チェーンから呼ばれる）から委譲される。
 * {@code OAuth2UserInfo} を入力に、以下の判定と DB 操作を行う:
 *
 * <ol>
 *   <li>(provider, provider_user_id) で既存 OAuth 接続を検索 → ログイン or ステータスチェック</li>
 *   <li>email で既存ユーザーを検索 → 条件に応じて以下に分岐
 *     <ul>
 *       <li>{@code email_verified=false} → {@code OAUTH_EMAIL_VERIFICATION_REQUIRED}</li>
 *       <li>role=ADMIN → {@code OAUTH_ADMIN_NOT_ALLOWED}</li>
 *       <li>{@code email_verified=true} かつ非管理者 → リンク確認フロー（Phase 4 で {@code OAuthLinkConfirmationService} 統合）</li>
 *     </ul>
 *   </li>
 *   <li>どちらも見つからない場合: 新規ユーザー作成（{@code username_temporary=true}, {@code password_hash=null}, 仮ユーザー名）</li>
 * </ol>
 *
 * <p>ステータスチェック: SUSPENDED は拒否、ソフトデリート済みは {@code AuthService#recoverSoftDeletedUser} で復旧。
 * レース条件: {@code DataIntegrityViolationException} をキャッチして {@code findByEmail} 再検索（3.29）。
 * 全体は {@code @Transactional(rollbackFor = Exception.class)} でラップ（3.28）。</p>
 *
 * <p>本クラスは Phase 3b Red 段階のスケルトン。メソッドは {@code UnsupportedOperationException} を投げる。</p>
 */
@Service
public class OAuth2UserServiceHelper {

    private final UserRepository userRepository;
    private final UserOAuthConnectionRepository userOAuthConnectionRepository;
    private final AuthService authService;
    private final OAuthTokenEncryptor oauthTokenEncryptor;
    private final SecurityAuditLogger securityAuditLogger;

    public OAuth2UserServiceHelper(
            UserRepository userRepository,
            UserOAuthConnectionRepository userOAuthConnectionRepository,
            AuthService authService,
            OAuthTokenEncryptor oauthTokenEncryptor,
            SecurityAuditLogger securityAuditLogger) {
        this.userRepository = userRepository;
        this.userOAuthConnectionRepository = userOAuthConnectionRepository;
        this.authService = authService;
        this.oauthTokenEncryptor = oauthTokenEncryptor;
        this.securityAuditLogger = securityAuditLogger;
    }

    /**
     * OAuth 認証完了後のユーザー特定・作成・復旧処理を行う。
     *
     * @param info 正規化済み OAuth ユーザー情報
     * @return 認証結果（ログイン成功時の User、またはリンク確認フロー中のトークン）
     * @throws org.springframework.security.oauth2.core.OAuth2AuthenticationException
     *         SUSPENDED / ADMIN / EMAIL_VERIFICATION_REQUIRED / EMAIL_REQUIRED など
     */
    @Transactional(rollbackFor = Exception.class)
    public User processOAuthUser(OAuth2UserInfo info) {
        throw new UnsupportedOperationException("Issue#81 Phase 3b Red 段階: 未実装");
    }
}
