package com.photlas.backend.service;

import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.util.OAuthTokenEncryptor;
import com.photlas.backend.util.SecurityAuditLogger;
import org.springframework.scheduling.annotation.Async;

import java.util.concurrent.CompletableFuture;

/**
 * Issue#81 Phase 4c - 退会時の OAuth access_token revoke サービス（Round 12 / Q9）。
 *
 * <p>Red 段階のスタブ実装。Green 段階で本体を実装する。
 *
 * <p>設計:
 * <ul>
 *   <li>{@code @Async("taskExecutor")} で非同期実行、退会レスポンスをブロックしない</li>
 *   <li>期限切れ token は revoke をスキップ、WARN ログのみ</li>
 *   <li>revoke 失敗時は best-effort として例外を飲み込み WARN ログ、退会処理は失敗させない</li>
 *   <li>成功時は {@code access_token_encrypted} / {@code token_encrypted_iv} を NULL クリア</li>
 * </ul>
 */
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
        throw new UnsupportedOperationException("Phase 4c Green で実装する");
    }
}
