package com.photlas.backend.service;

import com.photlas.backend.dto.PasswordRecommendationResponse;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Issue#81 Phase 4f - {@link PasswordRecommendationService} のテスト（Red 段階）。
 *
 * <p>推奨条件（Round 12 / Q8 / [2-G]）:
 * <ul>
 *   <li>{@code usernameTemporary == false}</li>
 *   <li>{@code password_hash IS NULL}</li>
 *   <li>{@code dismissed_at IS NULL} または {@code dismissed_at + 7 days < NOW()}</li>
 * </ul>
 *
 * <p>データ不整合（OAuth のみユーザーなのに user_oauth_connections が空）の場合は
 * {@code shouldRecommend=false} でフェイルセーフ。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordRecommendationServiceTest {

    private static final String EMAIL = "user@example.com";
    private static final Long USER_ID = 42L;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserOAuthConnectionRepository userOAuthConnectionRepository;

    private PasswordRecommendationService service;

    @BeforeEach
    void setUp() {
        service = new PasswordRecommendationService(userRepository, userOAuthConnectionRepository);
    }

    // ---------- evaluate ----------

    @Test
    @DisplayName("通常ユーザー (password_hash != null): shouldRecommend=false")
    void normalUser_doesNotRecommend() {
        User user = newUser(USER_ID, "$2a$hashed", /*usernameTemporary*/ false, null);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        PasswordRecommendationResponse response = service.evaluate(EMAIL);

        assertThat(response.shouldRecommend()).isFalse();
    }

    @Test
    @DisplayName("OAuth のみユーザー (password_hash == null, 確定済みユーザー名, dismissed_at=null): shouldRecommend=true + provider 返却")
    void oauthOnlyUser_allConditionsMet_recommends() {
        User user = newUser(USER_ID, /*passwordHash*/ null, /*usernameTemporary*/ false, /*dismissedAt*/ null);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(userOAuthConnectionRepository.findByUserId(USER_ID))
                .thenReturn(List.of(googleConnection()));

        PasswordRecommendationResponse response = service.evaluate(EMAIL);

        assertThat(response.shouldRecommend()).isTrue();
        assertThat(response.provider()).isEqualTo("GOOGLE");
    }

    @Test
    @DisplayName("OAuth のみユーザー + username_temporary=true: shouldRecommend=false（ユーザー名確定前はバナーを出さない）")
    void oauthOnlyUser_usernameTemporary_doesNotRecommend() {
        User user = newUser(USER_ID, null, /*usernameTemporary*/ true, null);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        PasswordRecommendationResponse response = service.evaluate(EMAIL);

        assertThat(response.shouldRecommend()).isFalse();
    }

    @Test
    @DisplayName("OAuth のみユーザー + dismissed_at が 7 日以内: shouldRecommend=false")
    void oauthOnlyUser_dismissedRecently_doesNotRecommend() {
        User user = newUser(USER_ID, null, false, LocalDateTime.now().minusDays(3));
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));

        PasswordRecommendationResponse response = service.evaluate(EMAIL);

        assertThat(response.shouldRecommend()).isFalse();
    }

    @Test
    @DisplayName("OAuth のみユーザー + dismissed_at が 7 日超過: shouldRecommend=true")
    void oauthOnlyUser_dismissedOver7DaysAgo_recommends() {
        User user = newUser(USER_ID, null, false, LocalDateTime.now().minusDays(8));
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(userOAuthConnectionRepository.findByUserId(USER_ID))
                .thenReturn(List.of(lineConnection()));

        PasswordRecommendationResponse response = service.evaluate(EMAIL);

        assertThat(response.shouldRecommend()).isTrue();
        assertThat(response.provider()).isEqualTo("LINE");
    }

    @Test
    @DisplayName("OAuth のみユーザーなのに user_oauth_connections が空: データ不整合、shouldRecommend=false でフェイルセーフ")
    void oauthOnlyUser_withNoConnections_failSafeFalse() {
        User user = newUser(USER_ID, null, false, null);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(userOAuthConnectionRepository.findByUserId(USER_ID)).thenReturn(List.of());

        PasswordRecommendationResponse response = service.evaluate(EMAIL);

        assertThat(response.shouldRecommend()).isFalse();
        assertThat(response.provider()).isNull();
    }

    @Test
    @DisplayName("ユーザーが見つからない場合は UnauthorizedException")
    void userNotFound_throwsUnauthorized() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.evaluate(EMAIL))
                .isInstanceOf(UnauthorizedException.class);
    }

    // ---------- dismiss ----------

    @Test
    @DisplayName("dismiss: dismissed_at を NOW() に更新して save")
    void dismiss_setsDismissedAtToNow() {
        User user = newUser(USER_ID, null, false, null);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        LocalDateTime before = LocalDateTime.now().minusSeconds(1);
        service.dismiss(EMAIL);
        LocalDateTime after = LocalDateTime.now().plusSeconds(1);

        verify(userRepository).save(argThat(u ->
                u.getPasswordRecommendationDismissedAt() != null
                        && u.getPasswordRecommendationDismissedAt().isAfter(before)
                        && u.getPasswordRecommendationDismissedAt().isBefore(after)
        ));
    }

    @Test
    @DisplayName("dismiss: ユーザーが見つからない場合は UnauthorizedException、save は呼ばれない")
    void dismiss_userNotFound_throwsUnauthorized() {
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.dismiss(EMAIL))
                .isInstanceOf(UnauthorizedException.class);

        verify(userRepository, never()).save(any());
    }

    // ---------- ヘルパー ----------

    private static User newUser(Long id, String passwordHash, boolean usernameTemporary, LocalDateTime dismissedAt) {
        User user = new User("alice", EMAIL, passwordHash, CodeConstants.ROLE_USER);
        user.setId(id);
        user.setEmailVerified(true);
        user.setUsernameTemporary(usernameTemporary);
        user.setPasswordRecommendationDismissedAt(dismissedAt);
        return user;
    }

    private static UserOAuthConnection googleConnection() {
        UserOAuthConnection c = new UserOAuthConnection();
        c.setUserId(USER_ID);
        c.setProviderCode(OAuthProvider.GOOGLE.getCode());
        c.setProviderUserId("google-sub-1");
        return c;
    }

    private static UserOAuthConnection lineConnection() {
        UserOAuthConnection c = new UserOAuthConnection();
        c.setUserId(USER_ID);
        c.setProviderCode(OAuthProvider.LINE.getCode());
        c.setProviderUserId("line-user-1");
        return c;
    }
}
