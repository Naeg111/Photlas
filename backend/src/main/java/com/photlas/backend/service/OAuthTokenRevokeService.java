package com.photlas.backend.service;

import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.util.OAuthTokenEncryptor;
import com.photlas.backend.util.SecurityAuditLogger;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * Issue#81 Phase 4c - 退会時の OAuth access_token revoke サービス（Round 12 / Q9）。
 *
 * <p>処理フロー（ユーザー 1 人あたり）:
 * <ol>
 *   <li>{@link UserOAuthConnectionRepository#findByUserId} で全連携取得</li>
 *   <li>各連携について: access_token_encrypted が null / token_expires_at が過去 / 復号失敗 / revoke 失敗 の
 *       いずれかに該当する場合は WARN ログを残してスキップ（best-effort）</li>
 *   <li>revoke 成功時のみ access_token_encrypted / token_encrypted_iv を NULL クリアして save</li>
 * </ol>
 *
 * <p>例外は全て飲み込み、退会処理トランザクション（既に commit 済み）を巻き戻さない。
 * 非同期実行（{@code @Async("taskExecutor")}）でレスポンスをブロックしない。
 */
@Service
@ConditionalOnProperty(name = "photlas.oauth.enabled", havingValue = "true")
public class OAuthTokenRevokeService {

    private final UserOAuthConnectionRepository userOAuthConnectionRepository;
    private final OAuthTokenEncryptor encryptor;
    private final SecurityAuditLogger auditLogger;
    private final OAuthProviderRevokeClient revokeClient;

    public OAuthTokenRevokeService(
            UserOAuthConnectionRepository userOAuthConnectionRepository,
            OAuthTokenEncryptor encryptor,
            SecurityAuditLogger auditLogger,
            OAuthProviderRevokeClient revokeClient) {
        this.userOAuthConnectionRepository = userOAuthConnectionRepository;
        this.encryptor = encryptor;
        this.auditLogger = auditLogger;
        this.revokeClient = revokeClient;
    }

    /**
     * 指定ユーザーの全 OAuth 連携について access_token の revoke を試みる。
     *
     * @param userId 対象ユーザー ID
     * @return 非同期完了を表す CompletableFuture（結果は無視可）
     */
    @Async("taskExecutor")
    public CompletableFuture<Void> revokeForUser(Long userId) {
        List<UserOAuthConnection> connections = userOAuthConnectionRepository.findByUserId(userId);
        for (UserOAuthConnection conn : connections) {
            try {
                revokeSingleConnection(userId, conn);
            } catch (Exception e) {
                // 想定外の例外もここで飲み込み、次の連携の revoke を続行する
                auditLogger.logWarn(
                        SecurityAuditLogger.Event.OAUTH_TOKEN_REVOKE_FAILED,
                        fields(userId, conn.getProviderCode(), "unexpected_error"));
            }
        }
        return CompletableFuture.completedFuture(null);
    }

    private void revokeSingleConnection(Long userId, UserOAuthConnection conn) {
        // 暗号化トークンが無ければ revoke 対象なし
        if (conn.getAccessTokenEncrypted() == null || conn.getTokenEncryptedIv() == null) {
            return;
        }

        // 期限切れトークンは revoke してもエラーになるだけなのでスキップ（best-effort）
        if (conn.getTokenExpiresAt() != null && conn.getTokenExpiresAt().isBefore(LocalDateTime.now())) {
            auditLogger.logWarn(
                    SecurityAuditLogger.Event.OAUTH_TOKEN_REVOKE_FAILED,
                    fields(userId, conn.getProviderCode(), "expired"));
            return;
        }

        // 復号
        String accessToken;
        try {
            accessToken = encryptor.decrypt(conn.getAccessTokenEncrypted(), conn.getTokenEncryptedIv());
        } catch (Exception e) {
            auditLogger.logWarn(
                    SecurityAuditLogger.Event.OAUTH_TOKEN_REVOKE_FAILED,
                    fields(userId, conn.getProviderCode(), "decrypt_failed"));
            return;
        }

        // revoke API 呼び出し
        OAuthProvider provider = OAuthProvider.fromCode(conn.getProviderCode());
        try {
            revokeClient.revoke(provider, accessToken);
        } catch (Exception e) {
            auditLogger.logWarn(
                    SecurityAuditLogger.Event.OAUTH_TOKEN_REVOKE_FAILED,
                    fields(userId, conn.getProviderCode(), e.getClass().getSimpleName()));
            return;
        }

        // 成功: access_token を DB から消す（再取得は次回 OAuth ログイン時）
        conn.setAccessTokenEncrypted(null);
        conn.setTokenEncryptedIv(null);
        userOAuthConnectionRepository.save(conn);
    }

    /** PII を含まないフィールド構築（user_id / provider / reason のみ）。 */
    private static Map<String, Object> fields(Long userId, Integer providerCode, String reason) {
        // LinkedHashMap で順序を担保し、CloudWatch Logs Insights での集計を容易にする
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("user_id", userId);
        fields.put("provider", providerName(providerCode));
        fields.put("reason", reason);
        return fields;
    }

    private static String providerName(Integer code) {
        try {
            return code == null ? "UNKNOWN" : OAuthProvider.fromCode(code).name();
        } catch (Exception e) {
            return "UNKNOWN";
        }
    }
}
