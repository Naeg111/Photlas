package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.OAuthLinkConfirmation;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.repository.OAuthLinkConfirmationRepository;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Issue#81 Phase 4g - {@link OAuthLinkConfirmationService} のテスト（Red 段階）。
 *
 * <p>Round 12 / [4-B-T6] を含む:
 * <ul>
 *   <li>issue: 生トークン（hex 64 文字）を返し、DB には SHA-256 ハッシュを expires_at=now+5min で保存</li>
 *   <li>consume: 有効トークンで UserOAuthConnection を作成、consumed_at を設定</li>
 *   <li>consume: 期限切れ・消費済み・未発行トークンは拒否</li>
 *   <li>[T6] consume: 発行後ユーザーがソフトデリートされた場合は拒否</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OAuthLinkConfirmationServiceTest {

    private static final Long USER_ID = 42L;
    private static final String PROVIDER_USER_ID = "google-sub-abc";
    private static final String PROVIDER_EMAIL = "user@example.com";

    @Mock
    private OAuthLinkConfirmationRepository repository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserOAuthConnectionRepository userOAuthConnectionRepository;

    private OAuthLinkConfirmationService service;

    @BeforeEach
    void setUp() {
        service = new OAuthLinkConfirmationService(
                repository, userRepository, userOAuthConnectionRepository);
    }

    // ---------- issue ----------

    @Test
    @DisplayName("issue: hex 64 文字の生トークンを返し、SHA-256 ハッシュで保存、expires_at は現在+5 分")
    void issue_generatesHex64TokenAndSavesHashedWith5MinExpiry() {
        when(repository.save(any(OAuthLinkConfirmation.class))).thenAnswer(inv -> inv.getArgument(0));

        LocalDateTime before = LocalDateTime.now();
        String rawToken = service.issue(USER_ID, OAuthProvider.GOOGLE, PROVIDER_USER_ID, PROVIDER_EMAIL);
        LocalDateTime after = LocalDateTime.now();

        // 生トークンは hex 64 文字（32 バイトの 16 進表現）
        assertThat(rawToken).hasSize(64);
        assertThat(rawToken).matches("[0-9a-f]{64}");

        ArgumentCaptor<OAuthLinkConfirmation> captor = ArgumentCaptor.forClass(OAuthLinkConfirmation.class);
        verify(repository).save(captor.capture());
        OAuthLinkConfirmation saved = captor.getValue();

        // DB には SHA-256 ハッシュが保存される（生値ではない）
        assertThat(saved.getTokenHash()).isEqualTo(sha256Hex(rawToken));
        assertThat(saved.getTokenHash()).isNotEqualTo(rawToken);

        assertThat(saved.getUserId()).isEqualTo(USER_ID);
        assertThat(saved.getProviderCode()).isEqualTo(OAuthProvider.GOOGLE.getCode());
        assertThat(saved.getProviderUserId()).isEqualTo(PROVIDER_USER_ID);
        assertThat(saved.getProviderEmail()).isEqualTo(PROVIDER_EMAIL);
        assertThat(saved.getConsumedAt()).isNull();

        // expires_at: before+5min 〜 after+5min の範囲
        assertThat(saved.getExpiresAt()).isAfterOrEqualTo(before.plusMinutes(5).minusSeconds(1));
        assertThat(saved.getExpiresAt()).isBeforeOrEqualTo(after.plusMinutes(5).plusSeconds(1));
    }

    @Test
    @DisplayName("issue: 複数回呼んでも異なるトークンを返す")
    void issue_returnsDifferentTokensOnMultipleCalls() {
        when(repository.save(any(OAuthLinkConfirmation.class))).thenAnswer(inv -> inv.getArgument(0));

        String t1 = service.issue(USER_ID, OAuthProvider.GOOGLE, PROVIDER_USER_ID, PROVIDER_EMAIL);
        String t2 = service.issue(USER_ID, OAuthProvider.GOOGLE, PROVIDER_USER_ID, PROVIDER_EMAIL);

        assertThat(t1).isNotEqualTo(t2);
    }

    // ---------- consume: 正常系 ----------

    @Test
    @DisplayName("consume: 有効トークンで UserOAuthConnection が作成され、consumed_at が設定される")
    void consume_validToken_linksAccountAndMarksConsumed() {
        String rawToken = generateRawToken();
        String hashed = sha256Hex(rawToken);
        OAuthLinkConfirmation record = newRecord(hashed, OAuthProvider.GOOGLE, LocalDateTime.now().plusMinutes(2));

        User user = activeUser(USER_ID);

        when(repository.findByTokenHash(hashed)).thenReturn(Optional.of(record));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        User linked = service.consume(rawToken);

        assertThat(linked).isSameAs(user);
        // UserOAuthConnection が作成される
        ArgumentCaptor<UserOAuthConnection> connCaptor = ArgumentCaptor.forClass(UserOAuthConnection.class);
        verify(userOAuthConnectionRepository).save(connCaptor.capture());
        UserOAuthConnection conn = connCaptor.getValue();
        assertThat(conn.getUserId()).isEqualTo(USER_ID);
        assertThat(conn.getProviderCode()).isEqualTo(OAuthProvider.GOOGLE.getCode());
        assertThat(conn.getProviderUserId()).isEqualTo(PROVIDER_USER_ID);

        // consumed_at が設定されて save される
        assertThat(record.getConsumedAt()).isNotNull();
        verify(repository).save(record);
    }

    // ---------- consume: 拒否ケース ----------

    @Test
    @DisplayName("consume: 未発行トークンは拒否")
    void consume_unknownToken_rejected() {
        String rawToken = generateRawToken();
        when(repository.findByTokenHash(sha256Hex(rawToken))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.consume(rawToken))
                .isInstanceOf(IllegalArgumentException.class);

        verify(userOAuthConnectionRepository, never()).save(any());
    }

    @Test
    @DisplayName("consume: 期限切れトークンは拒否")
    void consume_expiredToken_rejected() {
        String rawToken = generateRawToken();
        OAuthLinkConfirmation record = newRecord(
                sha256Hex(rawToken), OAuthProvider.GOOGLE,
                LocalDateTime.now().minusMinutes(1));
        when(repository.findByTokenHash(sha256Hex(rawToken))).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> service.consume(rawToken))
                .isInstanceOf(IllegalArgumentException.class);

        verify(userOAuthConnectionRepository, never()).save(any());
    }

    @Test
    @DisplayName("consume: 消費済みトークンは拒否")
    void consume_alreadyConsumed_rejected() {
        String rawToken = generateRawToken();
        OAuthLinkConfirmation record = newRecord(
                sha256Hex(rawToken), OAuthProvider.GOOGLE,
                LocalDateTime.now().plusMinutes(2));
        record.setConsumedAt(LocalDateTime.now().minusMinutes(1));
        when(repository.findByTokenHash(sha256Hex(rawToken))).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> service.consume(rawToken))
                .isInstanceOf(IllegalArgumentException.class);

        verify(userOAuthConnectionRepository, never()).save(any());
    }

    // ---------- consume: T6 ソフトデリート ----------

    @Test
    @DisplayName("[Issue#81 4-B-T6] consume: トークン発行後にユーザーがソフトデリートされた場合は拒否")
    void consume_afterUserSoftDeleted_rejected() {
        String rawToken = generateRawToken();
        OAuthLinkConfirmation record = newRecord(
                sha256Hex(rawToken), OAuthProvider.GOOGLE,
                LocalDateTime.now().plusMinutes(2));

        User softDeletedUser = activeUser(USER_ID);
        softDeletedUser.setDeletedAt(LocalDateTime.now().minusMinutes(1));

        when(repository.findByTokenHash(sha256Hex(rawToken))).thenReturn(Optional.of(record));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(softDeletedUser));

        assertThatThrownBy(() -> service.consume(rawToken))
                .isInstanceOf(IllegalArgumentException.class);

        verify(userOAuthConnectionRepository, never()).save(any());
    }

    @Test
    @DisplayName("consume: ユーザーが物理削除（findById empty）でも拒否")
    void consume_userMissing_rejected() {
        String rawToken = generateRawToken();
        OAuthLinkConfirmation record = newRecord(
                sha256Hex(rawToken), OAuthProvider.GOOGLE,
                LocalDateTime.now().plusMinutes(2));
        when(repository.findByTokenHash(sha256Hex(rawToken))).thenReturn(Optional.of(record));
        when(userRepository.findById(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.consume(rawToken))
                .isInstanceOf(IllegalArgumentException.class);

        verify(userOAuthConnectionRepository, never()).save(any());
    }

    // ---------- ヘルパー ----------

    private static String generateRawToken() {
        StringBuilder sb = new StringBuilder(64);
        for (int i = 0; i < 64; i++) sb.append('a');
        return sb.toString();
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes());
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static OAuthLinkConfirmation newRecord(String tokenHash, OAuthProvider provider, LocalDateTime expiresAt) {
        OAuthLinkConfirmation r = new OAuthLinkConfirmation();
        r.setTokenHash(tokenHash);
        r.setUserId(USER_ID);
        r.setProviderCode(provider.getCode());
        r.setProviderUserId(PROVIDER_USER_ID);
        r.setProviderEmail(PROVIDER_EMAIL);
        r.setExpiresAt(expiresAt);
        return r;
    }

    private static User activeUser(Long id) {
        User u = new User("alice", PROVIDER_EMAIL, "$2a$hashed", CodeConstants.ROLE_USER);
        u.setId(id);
        u.setEmailVerified(true);
        return u;
    }
}
