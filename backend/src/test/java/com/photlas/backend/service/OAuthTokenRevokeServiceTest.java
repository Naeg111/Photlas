package com.photlas.backend.service;

import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.util.OAuthTokenEncryptor;
import com.photlas.backend.util.SecurityAuditLogger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Issue#81 Phase 4c - {@link OAuthTokenRevokeService} のテスト（Red 段階）。
 *
 * <p>Round 12 / Q9（退会時 revoke）および [4-B-T5]（期限切れ token は revoke スキップ）の TDD ケース。
 *
 * <p>検証項目:
 * <ul>
 *   <li>連携なし: 何もしない</li>
 *   <li>Google 単体 / LINE 単体 / 両方: 該当プロバイダの revoke client が呼ばれる</li>
 *   <li>[T5] token_expires_at &lt; 現在: revoke client は呼ばれず WARN ログ</li>
 *   <li>access_token_encrypted が null: revoke client は呼ばれずスキップ</li>
 *   <li>revoke client が例外を投げた場合: 例外を飲み込み WARN ログ、token は NULL クリアされない</li>
 *   <li>成功時: access_token_encrypted / token_encrypted_iv を NULL クリアして save</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OAuthTokenRevokeServiceTest {

    private static final Long USER_ID = 42L;
    private static final byte[] ENCRYPTED_BYTES_GOOGLE = new byte[]{1, 2, 3};
    private static final byte[] ENCRYPTED_BYTES_LINE = new byte[]{4, 5, 6};
    private static final byte[] IV_GOOGLE = new byte[]{7, 8, 9};
    private static final byte[] IV_LINE = new byte[]{10, 11, 12};
    private static final String PLAIN_GOOGLE_TOKEN = "ya29.google-access-token";
    private static final String PLAIN_LINE_TOKEN = "line-access-token";

    @Mock
    private UserOAuthConnectionRepository userOAuthConnectionRepository;

    @Mock
    private OAuthTokenEncryptor encryptor;

    @Mock
    private SecurityAuditLogger auditLogger;

    @Mock
    private OAuthProviderRevokeClient revokeClient;

    private OAuthTokenRevokeService service;

    @BeforeEach
    void setUp() {
        service = new OAuthTokenRevokeService(
                userOAuthConnectionRepository, encryptor, auditLogger, revokeClient);
    }

    // ---------- 連携なしケース ----------

    @Test
    @DisplayName("連携なし: revokeClient も audit もログも呼ばれない")
    void noConnections_noActions() {
        when(userOAuthConnectionRepository.findByUserId(USER_ID)).thenReturn(List.of());

        service.revokeForUser(USER_ID).join();

        verify(revokeClient, never()).revoke(any(), any());
        verify(userOAuthConnectionRepository, never()).save(any());
    }

    // ---------- 単体プロバイダ成功 ----------

    @Test
    @DisplayName("Google 連携成功: revokeClient.revoke(GOOGLE, token) が呼ばれ、access_token_encrypted が NULL クリアされる")
    void googleSuccess_clientCalledAndTokenCleared() {
        UserOAuthConnection conn = googleConnection(ENCRYPTED_BYTES_GOOGLE, IV_GOOGLE, futureExpiry());
        when(userOAuthConnectionRepository.findByUserId(USER_ID)).thenReturn(List.of(conn));
        when(encryptor.decrypt(ENCRYPTED_BYTES_GOOGLE, IV_GOOGLE)).thenReturn(PLAIN_GOOGLE_TOKEN);

        service.revokeForUser(USER_ID).join();

        verify(revokeClient).revoke(OAuthProvider.GOOGLE, PLAIN_GOOGLE_TOKEN);
        verify(userOAuthConnectionRepository).save(conn);
        assertThat(conn.getAccessTokenEncrypted()).isNull();
        assertThat(conn.getTokenEncryptedIv()).isNull();
    }

    @Test
    @DisplayName("LINE 連携成功: revokeClient.revoke(LINE, token) が呼ばれる")
    void lineSuccess_clientCalled() {
        UserOAuthConnection conn = lineConnection(ENCRYPTED_BYTES_LINE, IV_LINE, futureExpiry());
        when(userOAuthConnectionRepository.findByUserId(USER_ID)).thenReturn(List.of(conn));
        when(encryptor.decrypt(ENCRYPTED_BYTES_LINE, IV_LINE)).thenReturn(PLAIN_LINE_TOKEN);

        service.revokeForUser(USER_ID).join();

        verify(revokeClient).revoke(OAuthProvider.LINE, PLAIN_LINE_TOKEN);
        verify(userOAuthConnectionRepository).save(conn);
    }

    // ---------- 両方プロバイダ ----------

    @Test
    @DisplayName("Google / LINE 両方連携: 両プロバイダに revoke が呼ばれる")
    void bothProviders_bothRevoked() {
        UserOAuthConnection google = googleConnection(ENCRYPTED_BYTES_GOOGLE, IV_GOOGLE, futureExpiry());
        UserOAuthConnection line = lineConnection(ENCRYPTED_BYTES_LINE, IV_LINE, futureExpiry());
        when(userOAuthConnectionRepository.findByUserId(USER_ID)).thenReturn(List.of(google, line));
        when(encryptor.decrypt(ENCRYPTED_BYTES_GOOGLE, IV_GOOGLE)).thenReturn(PLAIN_GOOGLE_TOKEN);
        when(encryptor.decrypt(ENCRYPTED_BYTES_LINE, IV_LINE)).thenReturn(PLAIN_LINE_TOKEN);

        service.revokeForUser(USER_ID).join();

        verify(revokeClient).revoke(OAuthProvider.GOOGLE, PLAIN_GOOGLE_TOKEN);
        verify(revokeClient).revoke(OAuthProvider.LINE, PLAIN_LINE_TOKEN);
    }

    // ---------- [T5] 期限切れ token ----------

    @Test
    @DisplayName("[Issue#81 4-B-T5] token_expires_at < 現在: revoke はスキップされ WARN ログが出る")
    void tokenExpired_skipsRevokeAndLogsWarn() {
        UserOAuthConnection conn = googleConnection(ENCRYPTED_BYTES_GOOGLE, IV_GOOGLE, pastExpiry());
        when(userOAuthConnectionRepository.findByUserId(USER_ID)).thenReturn(List.of(conn));

        service.revokeForUser(USER_ID).join();

        verify(revokeClient, never()).revoke(any(), any());
        verify(auditLogger).logWarn(eq(SecurityAuditLogger.Event.OAUTH_TOKEN_REVOKE_FAILED), anyMap());
        // 期限切れトークンは保存変更しない
        verify(userOAuthConnectionRepository, never()).save(any());
    }

    // ---------- access_token_encrypted が null ----------

    @Test
    @DisplayName("access_token_encrypted が null: revoke はスキップされ save も呼ばれない")
    void nullEncryptedToken_skipped() {
        UserOAuthConnection conn = googleConnection(null, null, futureExpiry());
        when(userOAuthConnectionRepository.findByUserId(USER_ID)).thenReturn(List.of(conn));

        service.revokeForUser(USER_ID).join();

        verify(revokeClient, never()).revoke(any(), any());
        verify(userOAuthConnectionRepository, never()).save(any());
    }

    // ---------- revoke 失敗時の best-effort 動作 ----------

    @Test
    @DisplayName("revoke 失敗: 例外を飲み込み WARN ログ、token は NULL クリアされない、退会処理は続行可能")
    void revokeFails_logsWarnAndDoesNotThrow() {
        UserOAuthConnection conn = googleConnection(ENCRYPTED_BYTES_GOOGLE, IV_GOOGLE, futureExpiry());
        when(userOAuthConnectionRepository.findByUserId(USER_ID)).thenReturn(List.of(conn));
        when(encryptor.decrypt(ENCRYPTED_BYTES_GOOGLE, IV_GOOGLE)).thenReturn(PLAIN_GOOGLE_TOKEN);
        doThrow(new RuntimeException("HTTP 500"))
                .when(revokeClient).revoke(OAuthProvider.GOOGLE, PLAIN_GOOGLE_TOKEN);

        // 例外が外部に伝播しないことを確認（best-effort）
        service.revokeForUser(USER_ID).join();

        verify(auditLogger).logWarn(eq(SecurityAuditLogger.Event.OAUTH_TOKEN_REVOKE_FAILED), anyMap());
        // 失敗時は token NULL クリアしない（次回試行の余地を残す）
        assertThat(conn.getAccessTokenEncrypted()).isEqualTo(ENCRYPTED_BYTES_GOOGLE);
        verify(userOAuthConnectionRepository, never()).save(any());
    }

    @Test
    @DisplayName("Google 成功 / LINE 失敗: 独立にハンドリングされ、LINE 失敗は Google クリアに影響しない")
    void oneSucceedsOneFails_independentHandling() {
        UserOAuthConnection google = googleConnection(ENCRYPTED_BYTES_GOOGLE, IV_GOOGLE, futureExpiry());
        UserOAuthConnection line = lineConnection(ENCRYPTED_BYTES_LINE, IV_LINE, futureExpiry());
        when(userOAuthConnectionRepository.findByUserId(USER_ID)).thenReturn(List.of(google, line));
        when(encryptor.decrypt(ENCRYPTED_BYTES_GOOGLE, IV_GOOGLE)).thenReturn(PLAIN_GOOGLE_TOKEN);
        when(encryptor.decrypt(ENCRYPTED_BYTES_LINE, IV_LINE)).thenReturn(PLAIN_LINE_TOKEN);
        doThrow(new RuntimeException("LINE 500"))
                .when(revokeClient).revoke(OAuthProvider.LINE, PLAIN_LINE_TOKEN);

        service.revokeForUser(USER_ID).join();

        // Google: 成功 → token クリアされ save
        assertThat(google.getAccessTokenEncrypted()).isNull();
        verify(userOAuthConnectionRepository).save(google);
        // LINE: 失敗 → token 残存、save されない
        assertThat(line.getAccessTokenEncrypted()).isEqualTo(ENCRYPTED_BYTES_LINE);
        verify(userOAuthConnectionRepository, never()).save(line);
    }

    // ---------- ヘルパー ----------

    private static UserOAuthConnection googleConnection(byte[] encrypted, byte[] iv, LocalDateTime expiresAt) {
        return buildConnection(OAuthProvider.GOOGLE, "google-user-id-1", encrypted, iv, expiresAt);
    }

    private static UserOAuthConnection lineConnection(byte[] encrypted, byte[] iv, LocalDateTime expiresAt) {
        return buildConnection(OAuthProvider.LINE, "U0123456789abcdef", encrypted, iv, expiresAt);
    }

    private static UserOAuthConnection buildConnection(
            OAuthProvider provider, String providerUserId,
            byte[] encrypted, byte[] iv, LocalDateTime expiresAt) {
        UserOAuthConnection conn = new UserOAuthConnection();
        conn.setUserId(USER_ID);
        conn.setProviderCode(provider.getCode());
        conn.setProviderUserId(providerUserId);
        conn.setAccessTokenEncrypted(encrypted);
        conn.setTokenEncryptedIv(iv);
        conn.setTokenExpiresAt(expiresAt);
        return conn;
    }

    private static LocalDateTime futureExpiry() {
        return LocalDateTime.now().plusHours(1);
    }

    private static LocalDateTime pastExpiry() {
        return LocalDateTime.now().minusHours(1);
    }

    @SuppressWarnings("unused")
    private static Map<String, Object> anyFields() {
        return Map.of();
    }
}
