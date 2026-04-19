package com.photlas.backend.repository;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserOAuthConnection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Issue#81 Phase 2 - UserOAuthConnectionRepository のテスト
 *
 * 要件:
 *   - user_id で連携情報を取得できる（findByUserId）
 *   - (provider_code, provider_user_id) で連携情報を取得できる（findByProviderCodeAndProviderUserId）
 *   - 1 ユーザー 1 プロバイダ制限（UNIQUE(user_id, provider_code)）
 *   - プロバイダー内でユーザー ID 一意制限（UNIQUE(provider_code, provider_user_id)）
 *   - user_id で削除できる（deleteByUserId）
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class UserOAuthConnectionRepositoryTest {

    @Autowired
    private UserOAuthConnectionRepository userOAuthConnectionRepository;

    @Autowired
    private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setUp() {
        userOAuthConnectionRepository.deleteAll();
        userRepository.deleteAll();

        user = new User();
        user.setUsername("oauthuser");
        user.setEmail("oauth@example.com");
        user.setPasswordHash(null); // OAuth のみユーザー
        user.setRole(CodeConstants.ROLE_USER);
        user = userRepository.save(user);
    }

    @Test
    @DisplayName("Issue#81 - user_id で連携情報を取得できる")
    void findByUserIdReturnsConnection() {
        UserOAuthConnection conn = new UserOAuthConnection();
        conn.setUserId(user.getId());
        conn.setProviderCode(OAuthProvider.GOOGLE.getCode());
        conn.setProviderUserId("google-sub-123");
        conn.setEmail("oauth@example.com");
        conn.setEmailVerified(true);
        userOAuthConnectionRepository.save(conn);

        List<UserOAuthConnection> found = userOAuthConnectionRepository.findByUserId(user.getId());

        assertThat(found).hasSize(1);
        assertThat(found.get(0).getProviderCode()).isEqualTo(OAuthProvider.GOOGLE.getCode());
        assertThat(found.get(0).getProviderUserId()).isEqualTo("google-sub-123");
    }

    @Test
    @DisplayName("Issue#81 - プロバイダコード + プロバイダユーザー ID で連携情報を取得できる")
    void findByProviderCodeAndProviderUserIdReturnsConnection() {
        UserOAuthConnection conn = new UserOAuthConnection();
        conn.setUserId(user.getId());
        conn.setProviderCode(OAuthProvider.LINE.getCode());
        conn.setProviderUserId("line-uid-456");
        conn.setEmail("oauth@example.com");
        conn.setEmailVerified(false);
        userOAuthConnectionRepository.save(conn);

        Optional<UserOAuthConnection> found = userOAuthConnectionRepository
                .findByProviderCodeAndProviderUserId(OAuthProvider.LINE.getCode(), "line-uid-456");

        assertThat(found).isPresent();
        assertThat(found.get().getUserId()).isEqualTo(user.getId());
    }

    @Test
    @DisplayName("Issue#81 - 存在しない連携情報の検索は空を返す")
    void findByProviderCodeAndProviderUserIdReturnsEmptyForUnknown() {
        Optional<UserOAuthConnection> found = userOAuthConnectionRepository
                .findByProviderCodeAndProviderUserId(OAuthProvider.GOOGLE.getCode(), "unknown");

        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("Issue#81 - 1 ユーザーが同じプロバイダに 2 度連携しようとすると DataIntegrityViolationException")
    void sameUserSameProviderDuplicateFails() {
        UserOAuthConnection first = new UserOAuthConnection();
        first.setUserId(user.getId());
        first.setProviderCode(OAuthProvider.GOOGLE.getCode());
        first.setProviderUserId("google-sub-123");
        userOAuthConnectionRepository.saveAndFlush(first);

        UserOAuthConnection second = new UserOAuthConnection();
        second.setUserId(user.getId());
        second.setProviderCode(OAuthProvider.GOOGLE.getCode());
        second.setProviderUserId("google-sub-999"); // 別の sub でも同一プロバイダは不可

        assertThatThrownBy(() -> userOAuthConnectionRepository.saveAndFlush(second))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Issue#81 - 同じプロバイダ内で同じ provider_user_id の重複が拒否される")
    void sameProviderSameProviderUserIdDuplicateFails() {
        UserOAuthConnection first = new UserOAuthConnection();
        first.setUserId(user.getId());
        first.setProviderCode(OAuthProvider.GOOGLE.getCode());
        first.setProviderUserId("google-sub-shared");
        userOAuthConnectionRepository.saveAndFlush(first);

        User otherUser = new User();
        otherUser.setUsername("otheruser");
        otherUser.setEmail("other@example.com");
        otherUser.setPasswordHash(null);
        otherUser.setRole(CodeConstants.ROLE_USER);
        otherUser = userRepository.save(otherUser);

        UserOAuthConnection second = new UserOAuthConnection();
        second.setUserId(otherUser.getId());
        second.setProviderCode(OAuthProvider.GOOGLE.getCode());
        second.setProviderUserId("google-sub-shared"); // 同じ sub

        assertThatThrownBy(() -> userOAuthConnectionRepository.saveAndFlush(second))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Issue#81 - user_id で連携情報を全削除できる")
    void deleteByUserIdRemovesAllConnections() {
        UserOAuthConnection googleConn = new UserOAuthConnection();
        googleConn.setUserId(user.getId());
        googleConn.setProviderCode(OAuthProvider.GOOGLE.getCode());
        googleConn.setProviderUserId("g1");
        userOAuthConnectionRepository.save(googleConn);

        userOAuthConnectionRepository.deleteByUserId(user.getId());

        assertThat(userOAuthConnectionRepository.findByUserId(user.getId())).isEmpty();
    }

    @Test
    @DisplayName("Issue#81 - 暗号化された access_token / IV / 有効期限を保存・取得できる")
    void savesEncryptedAccessTokenFields() {
        byte[] encryptedToken = new byte[] {1, 2, 3, 4};
        byte[] iv = new byte[] {5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16};
        LocalDateTime expiresAt = LocalDateTime.now().plusHours(1);

        UserOAuthConnection conn = new UserOAuthConnection();
        conn.setUserId(user.getId());
        conn.setProviderCode(OAuthProvider.GOOGLE.getCode());
        conn.setProviderUserId("g-token-user");
        conn.setAccessTokenEncrypted(encryptedToken);
        conn.setTokenEncryptedIv(iv);
        conn.setTokenExpiresAt(expiresAt);
        userOAuthConnectionRepository.saveAndFlush(conn);

        UserOAuthConnection reloaded = userOAuthConnectionRepository
                .findByProviderCodeAndProviderUserId(OAuthProvider.GOOGLE.getCode(), "g-token-user")
                .orElseThrow();

        assertThat(reloaded.getAccessTokenEncrypted()).containsExactly(encryptedToken);
        assertThat(reloaded.getTokenEncryptedIv()).containsExactly(iv);
        assertThat(reloaded.getTokenExpiresAt()).isNotNull();
    }
}
