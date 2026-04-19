package com.photlas.backend.service;

import com.photlas.backend.dto.OAuth2UserInfo;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.util.OAuthTokenEncryptor;
import com.photlas.backend.util.SecurityAuditLogger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Issue#81 Phase 3b Red - OAuth2UserServiceHelper#processOAuthUser() のテスト。
 *
 * 想定シナリオ（技術設計書 3.3 / 実装手順書 Phase 3）:
 * <ul>
 *   <li>新規ユーザー作成（OAuth 接続なし・メール未登録）</li>
 *   <li>既存 OAuth ユーザーのログイン（OAuth 接続あり）</li>
 *   <li>SUSPENDED ユーザーのログイン拒否</li>
 *   <li>ソフトデリート済みユーザーの復旧（AuthService.recoverSoftDeletedUser 呼び出し）</li>
 *   <li>メール一致・未認証 → OAUTH_EMAIL_VERIFICATION_REQUIRED</li>
 *   <li>メール一致・管理者 → OAUTH_ADMIN_NOT_ALLOWED</li>
 *   <li>メール一致・認証済み非管理者 → リンク確認フロー（OAUTH_LINK_CONFIRMATION_REQUIRED）</li>
 *   <li>OAuth2UserInfo の email が空 → OAUTH_EMAIL_REQUIRED</li>
 *   <li>OAuth2UserInfo の providerUserId が空 → OAuth2AuthenticationException</li>
 *   <li>レース条件: userRepository.save で DataIntegrityViolationException → findByEmail で再検索・紐付け</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class OAuth2UserServiceHelperTest {

    @Mock private UserRepository userRepository;
    @Mock private UserOAuthConnectionRepository userOAuthConnectionRepository;
    @Mock private AuthService authService;
    @Mock private OAuthTokenEncryptor oauthTokenEncryptor;
    @Mock private SecurityAuditLogger securityAuditLogger;

    private OAuth2UserServiceHelper helper;

    private static final String GOOGLE_SUB = "google-sub-123";
    private static final String EMAIL = "taro@example.com";

    @BeforeEach
    void setUp() {
        helper = new OAuth2UserServiceHelper(
                userRepository,
                userOAuthConnectionRepository,
                authService,
                oauthTokenEncryptor,
                securityAuditLogger
        );
    }

    /* -------------------------------------------------------------- */
    /* 1. 新規ユーザー作成                                             */
    /* -------------------------------------------------------------- */
    @Nested
    @DisplayName("新規ユーザー作成（OAuth 接続なし・メール未登録）")
    class NewUserCreation {

        @Test
        @DisplayName("Issue#81 - OAuth接続・メールどちらも未登録なら仮ユーザー名で新規作成し User を返す")
        void createsNewUserWithTemporaryUsername() {
            OAuth2UserInfo info = new OAuth2UserInfo(
                    OAuthProvider.GOOGLE, GOOGLE_SUB, EMAIL, "access-token-xyz", null, "ja");

            when(userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(
                    OAuthProvider.GOOGLE.getCode(), GOOGLE_SUB))
                    .thenReturn(Optional.empty());
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(1L);
                return u;
            });
            when(oauthTokenEncryptor.encrypt(any()))
                    .thenReturn(new OAuthTokenEncryptor.Encrypted(new byte[]{1, 2, 3}, new byte[]{4, 5, 6}));

            User result = helper.processOAuthUser(info);

            ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(userCaptor.capture());
            User saved = userCaptor.getValue();
            assertThat(saved.getEmail()).isEqualTo(EMAIL);
            assertThat(saved.getRole()).isEqualTo(CodeConstants.ROLE_USER);
            assertThat(saved.getPasswordHash()).isNull();
            assertThat(saved.isUsernameTemporary()).isTrue();
            assertThat(saved.isEmailVerified()).isTrue();
            assertThat(saved.getUsername()).matches("^user_[a-z0-9]{7}$");
            assertThat(saved.getLanguage()).isEqualTo("ja");

            verify(userOAuthConnectionRepository).save(any(UserOAuthConnection.class));
            assertThat(result).isNotNull();
        }

        @Test
        @DisplayName("Issue#81 - 新規ユーザー作成時は OAUTH_ACCOUNT_CREATED 監査ログを出力する")
        void auditLogsOauthAccountCreated() {
            OAuth2UserInfo info = new OAuth2UserInfo(
                    OAuthProvider.LINE, "line-uid-1", EMAIL, null, null, "ja");

            when(userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(
                    OAuthProvider.LINE.getCode(), "line-uid-1"))
                    .thenReturn(Optional.empty());
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
            when(userRepository.save(any(User.class))).thenAnswer(inv -> {
                User u = inv.getArgument(0);
                u.setId(42L);
                return u;
            });

            helper.processOAuthUser(info);

            verify(securityAuditLogger).log(
                    eq(SecurityAuditLogger.Event.OAUTH_ACCOUNT_CREATED),
                    any()
            );
        }

        @Test
        @DisplayName("Issue#81 - 不正な language は LanguageValidator により 'ja' にフォールバックする")
        void unsupportedLanguageFallsBackToJa() {
            OAuth2UserInfo info = new OAuth2UserInfo(
                    OAuthProvider.GOOGLE, GOOGLE_SUB, EMAIL, null, null, "xx");

            when(userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(anyInt(), anyString()))
                    .thenReturn(Optional.empty());
            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());
            when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

            helper.processOAuthUser(info);

            ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
            verify(userRepository).save(captor.capture());
            assertThat(captor.getValue().getLanguage()).isEqualTo("ja");
        }
    }

    /* -------------------------------------------------------------- */
    /* 2. 既存 OAuth ユーザーのログイン                                 */
    /* -------------------------------------------------------------- */
    @Nested
    @DisplayName("既存 OAuth ユーザーのログイン")
    class ExistingOAuthUserLogin {

        @Test
        @DisplayName("Issue#81 - OAuth接続が既にある場合、紐付いた User をそのまま返す（新規作成しない）")
        void returnsExistingUserWithoutCreate() {
            OAuth2UserInfo info = new OAuth2UserInfo(OAuthProvider.GOOGLE, GOOGLE_SUB, EMAIL);

            User existingUser = new User("taroname", EMAIL, null, CodeConstants.ROLE_USER);
            existingUser.setId(1L);
            existingUser.setEmailVerified(true);

            UserOAuthConnection conn = new UserOAuthConnection();
            conn.setUserId(1L);
            conn.setProviderCode(OAuthProvider.GOOGLE.getCode());
            conn.setProviderUserId(GOOGLE_SUB);

            when(userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(
                    OAuthProvider.GOOGLE.getCode(), GOOGLE_SUB))
                    .thenReturn(Optional.of(conn));
            when(userRepository.findById(1L)).thenReturn(Optional.of(existingUser));

            User result = helper.processOAuthUser(info);

            assertThat(result).isSameAs(existingUser);
            verify(userRepository, never()).save(any(User.class));
            verify(userOAuthConnectionRepository, never()).save(any(UserOAuthConnection.class));
        }

        @Test
        @DisplayName("Issue#81 - OAuthログイン成功時は OAUTH_LOGIN_SUCCESS 監査ログを出力する")
        void auditLogsLoginSuccess() {
            OAuth2UserInfo info = new OAuth2UserInfo(OAuthProvider.GOOGLE, GOOGLE_SUB, EMAIL);

            User existingUser = new User("taroname", EMAIL, null, CodeConstants.ROLE_USER);
            existingUser.setId(1L);
            existingUser.setEmailVerified(true);

            UserOAuthConnection conn = new UserOAuthConnection();
            conn.setUserId(1L);

            when(userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(anyInt(), anyString()))
                    .thenReturn(Optional.of(conn));
            when(userRepository.findById(1L)).thenReturn(Optional.of(existingUser));

            helper.processOAuthUser(info);

            verify(securityAuditLogger).log(
                    eq(SecurityAuditLogger.Event.OAUTH_LOGIN_SUCCESS),
                    any()
            );
        }
    }

    /* -------------------------------------------------------------- */
    /* 3. SUSPENDED ユーザーの拒否                                     */
    /* -------------------------------------------------------------- */
    @Test
    @DisplayName("Issue#81 - OAuth接続済みユーザーの role が SUSPENDED なら OAuth2AuthenticationException（USER_SUSPENDED）")
    void suspendedUserIsRejected() {
        OAuth2UserInfo info = new OAuth2UserInfo(OAuthProvider.GOOGLE, GOOGLE_SUB, EMAIL);

        User suspended = new User("suspendedname", EMAIL, null, CodeConstants.ROLE_SUSPENDED);
        suspended.setId(5L);
        suspended.setEmailVerified(true);

        UserOAuthConnection conn = new UserOAuthConnection();
        conn.setUserId(5L);

        when(userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(anyInt(), anyString()))
                .thenReturn(Optional.of(conn));
        when(userRepository.findById(5L)).thenReturn(Optional.of(suspended));

        assertThatThrownBy(() -> helper.processOAuthUser(info))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("USER_SUSPENDED");
    }

    /* -------------------------------------------------------------- */
    /* 4. ソフトデリート済みユーザーの復旧                              */
    /* -------------------------------------------------------------- */
    @Test
    @DisplayName("Issue#81 - OAuth接続済みユーザーの deletedAt != null なら AuthService.recoverSoftDeletedUser を呼ぶ")
    void softDeletedUserTriggersRecovery() {
        OAuth2UserInfo info = new OAuth2UserInfo(OAuthProvider.GOOGLE, GOOGLE_SUB, EMAIL);

        User softDeleted = new User("user_abcdefg", EMAIL, null, CodeConstants.ROLE_USER);
        softDeleted.setId(7L);
        softDeleted.setEmailVerified(true);
        softDeleted.setDeletedAt(LocalDateTime.now().minusDays(1));
        softDeleted.setOriginalUsername("taroname");

        UserOAuthConnection conn = new UserOAuthConnection();
        conn.setUserId(7L);

        when(userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(anyInt(), anyString()))
                .thenReturn(Optional.of(conn));
        when(userRepository.findById(7L)).thenReturn(Optional.of(softDeleted));

        helper.processOAuthUser(info);

        verify(authService, times(1)).recoverSoftDeletedUser(softDeleted);
        verify(securityAuditLogger).log(
                eq(SecurityAuditLogger.Event.OAUTH_ACCOUNT_RECOVERED),
                any()
        );
    }

    /* -------------------------------------------------------------- */
    /* 5. 未認証メール一致                                              */
    /* -------------------------------------------------------------- */
    @Test
    @DisplayName("Issue#81 - メール一致・email_verified=false なら OAUTH_EMAIL_VERIFICATION_REQUIRED")
    void unverifiedEmailMatchIsRejected() {
        OAuth2UserInfo info = new OAuth2UserInfo(OAuthProvider.LINE, "line-uid-2", EMAIL);

        User unverified = new User("taroname", EMAIL, "hash", CodeConstants.ROLE_USER);
        unverified.setId(10L);
        unverified.setEmailVerified(false);

        when(userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(anyInt(), anyString()))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(unverified));

        assertThatThrownBy(() -> helper.processOAuthUser(info))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("OAUTH_EMAIL_VERIFICATION_REQUIRED");

        verify(userRepository, never()).save(any(User.class));
        verify(userOAuthConnectionRepository, never()).save(any(UserOAuthConnection.class));
    }

    /* -------------------------------------------------------------- */
    /* 6. 管理者メール一致                                              */
    /* -------------------------------------------------------------- */
    @Test
    @DisplayName("Issue#81 - メール一致・role=ADMIN なら OAUTH_ADMIN_NOT_ALLOWED")
    void adminEmailMatchIsRejected() {
        OAuth2UserInfo info = new OAuth2UserInfo(OAuthProvider.GOOGLE, GOOGLE_SUB, EMAIL);

        User admin = new User("admin", EMAIL, "hash", CodeConstants.ROLE_ADMIN);
        admin.setId(99L);
        admin.setEmailVerified(true);

        when(userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(anyInt(), anyString()))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> helper.processOAuthUser(info))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("OAUTH_ADMIN_NOT_ALLOWED");

        verify(userRepository, never()).save(any(User.class));
    }

    /* -------------------------------------------------------------- */
    /* 7. 認証済み非管理者メール一致 → リンク確認フロー                 */
    /* -------------------------------------------------------------- */
    @Test
    @DisplayName("Issue#81 - メール一致・email_verified=true・非管理者 なら OAUTH_LINK_CONFIRMATION_REQUIRED")
    void verifiedEmailMatchTriggersLinkConfirmation() {
        OAuth2UserInfo info = new OAuth2UserInfo(OAuthProvider.GOOGLE, GOOGLE_SUB, EMAIL);

        User existing = new User("taroname", EMAIL, "hash", CodeConstants.ROLE_USER);
        existing.setId(20L);
        existing.setEmailVerified(true);

        when(userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(anyInt(), anyString()))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> helper.processOAuthUser(info))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("OAUTH_LINK_CONFIRMATION_REQUIRED");

        // この時点では OAuth 接続は INSERT しない（リンク確認後に Phase 4 で INSERT）
        verify(userOAuthConnectionRepository, never()).save(any(UserOAuthConnection.class));
    }

    /* -------------------------------------------------------------- */
    /* 8. info の email が空                                            */
    /* -------------------------------------------------------------- */
    @Test
    @DisplayName("Issue#81 - OAuth2UserInfo.email が null なら OAUTH_EMAIL_REQUIRED")
    void nullEmailIsRejected() {
        OAuth2UserInfo info = new OAuth2UserInfo(OAuthProvider.LINE, "line-uid-3", null);

        assertThatThrownBy(() -> helper.processOAuthUser(info))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("OAUTH_EMAIL_REQUIRED");
    }

    @Test
    @DisplayName("Issue#81 - OAuth2UserInfo.email が空白のみなら OAUTH_EMAIL_REQUIRED")
    void blankEmailIsRejected() {
        OAuth2UserInfo info = new OAuth2UserInfo(OAuthProvider.LINE, "line-uid-3", "   ");

        assertThatThrownBy(() -> helper.processOAuthUser(info))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("OAUTH_EMAIL_REQUIRED");
    }

    /* -------------------------------------------------------------- */
    /* 9. info の providerUserId が空                                   */
    /* -------------------------------------------------------------- */
    @Test
    @DisplayName("Issue#81 - OAuth2UserInfo.providerUserId が null なら OAuth2AuthenticationException")
    void nullProviderUserIdIsRejected() {
        OAuth2UserInfo info = new OAuth2UserInfo(OAuthProvider.GOOGLE, null, EMAIL);

        assertThatThrownBy(() -> helper.processOAuthUser(info))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    @Test
    @DisplayName("Issue#81 - OAuth2UserInfo.providerUserId が空白のみなら OAuth2AuthenticationException")
    void blankProviderUserIdIsRejected() {
        OAuth2UserInfo info = new OAuth2UserInfo(OAuthProvider.GOOGLE, "  ", EMAIL);

        assertThatThrownBy(() -> helper.processOAuthUser(info))
                .isInstanceOf(OAuth2AuthenticationException.class);
    }

    /* -------------------------------------------------------------- */
    /* 10. レース条件                                                   */
    /* -------------------------------------------------------------- */
    @Test
    @DisplayName("Issue#81 - userRepository.save で DataIntegrityViolationException が投げられたら findByEmail で再検索し、同じユーザーで続行")
    void raceConditionFindsExistingUserAfterDIVE() {
        OAuth2UserInfo info = new OAuth2UserInfo(
                OAuthProvider.GOOGLE, GOOGLE_SUB, EMAIL, null, null, "ja");

        User raceWinner = new User("user_raceaaa", EMAIL, null, CodeConstants.ROLE_USER);
        raceWinner.setId(50L);
        raceWinner.setEmailVerified(true);
        raceWinner.setUsernameTemporary(true);

        // 1 回目: OAuth 接続なし・email なし
        when(userOAuthConnectionRepository.findByProviderCodeAndProviderUserId(anyInt(), anyString()))
                .thenReturn(Optional.empty());
        when(userRepository.findByEmail(EMAIL))
                .thenReturn(Optional.empty())    // 1 回目: 新規作成のチェック
                .thenReturn(Optional.of(raceWinner)); // 2 回目: DIVE 後の再検索
        when(userRepository.save(any(User.class)))
                .thenThrow(new DataIntegrityViolationException("race: unique violation"));

        User result = helper.processOAuthUser(info);

        assertThat(result).isSameAs(raceWinner);
        // 再検索後に OAuth 接続だけ紐付ける
        verify(userOAuthConnectionRepository).save(any(UserOAuthConnection.class));
    }
}
