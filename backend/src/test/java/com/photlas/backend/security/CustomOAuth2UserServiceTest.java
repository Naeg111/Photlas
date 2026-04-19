package com.photlas.backend.security;

import com.photlas.backend.dto.OAuth2UserInfo;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.service.OAuth2UserServiceHelper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.Collections;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Issue#81 Phase 3c - {@link CustomOAuth2UserService} のテスト（Red段階）。
 *
 * 検証項目:
 * <ul>
 *   <li>Google プロバイダ: {@code sub} を providerUserId、{@code email} を email として OAuth2UserInfo に詰めて helper に渡す</li>
 *   <li>LINE プロバイダ: {@code userId} を providerUserId、{@code email} を email として OAuth2UserInfo に詰めて helper に渡す</li>
 *   <li>access_token と有効期限（Instant → LocalDateTime）をそのまま OAuth2UserInfo に渡す</li>
 *   <li>HttpSession から lang 属性を読み取り OAuth2UserInfo に設定する</li>
 *   <li>helper の戻り値 User を {@link PhotlasOAuth2User} でラップし、元 OAuth2User の attributes を保持する</li>
 *   <li>helper が {@link OAuth2AuthenticationException} を投げた場合、そのまま再スローする</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class CustomOAuth2UserServiceTest {

    @Mock
    private OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate;

    @Mock
    private OAuth2UserServiceHelper helper;

    private CustomOAuth2UserService service;

    @BeforeEach
    void setUp() {
        service = new CustomOAuth2UserService(delegate, helper);
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    // ============================================================
    // Google プロバイダ
    // ============================================================

    @Nested
    @DisplayName("Google プロバイダ")
    class GoogleProvider {

        @Test
        @DisplayName("sub 属性を providerUserId、email 属性を email として helper に渡す")
        void extractsSubAndEmailFromGoogleAttributes() {
            OAuth2UserRequest userRequest = googleUserRequest("google-access-token", 3600);
            OAuth2User delegateUser = new DefaultOAuth2User(
                    Collections.singleton(new SimpleGrantedAuthority("ROLE_USER")),
                    Map.of(
                            "sub", "google-user-12345",
                            "email", "alice@example.com",
                            "email_verified", true,
                            "name", "Alice"
                    ),
                    "sub"
            );
            when(delegate.loadUser(userRequest)).thenReturn(delegateUser);

            User returnedUser = newVerifiedUser(1L, "alice@example.com");
            when(helper.processOAuthUser(any(OAuth2UserInfo.class))).thenReturn(returnedUser);

            setSessionLang("ja");

            OAuth2User result = service.loadUser(userRequest);

            ArgumentCaptor<OAuth2UserInfo> infoCaptor = ArgumentCaptor.forClass(OAuth2UserInfo.class);
            org.mockito.Mockito.verify(helper).processOAuthUser(infoCaptor.capture());
            OAuth2UserInfo capturedInfo = infoCaptor.getValue();

            assertThat(capturedInfo.provider()).isEqualTo(OAuthProvider.GOOGLE);
            assertThat(capturedInfo.providerUserId()).isEqualTo("google-user-12345");
            assertThat(capturedInfo.email()).isEqualTo("alice@example.com");
            assertThat(capturedInfo.accessToken()).isEqualTo("google-access-token");
            assertThat(capturedInfo.tokenExpiresAt()).isNotNull();
            assertThat(capturedInfo.language()).isEqualTo("ja");

            assertThat(result).isInstanceOf(PhotlasOAuth2User.class);
            PhotlasOAuth2User photlasUser = (PhotlasOAuth2User) result;
            assertThat(photlasUser.getUser()).isSameAs(returnedUser);
            assertThat(photlasUser.getAttributes()).containsEntry("sub", "google-user-12345");
        }
    }

    // ============================================================
    // LINE プロバイダ
    // ============================================================

    @Nested
    @DisplayName("LINE プロバイダ")
    class LineProvider {

        @Test
        @DisplayName("userId 属性を providerUserId、email 属性を email として helper に渡す")
        void extractsUserIdAndEmailFromLineAttributes() {
            OAuth2UserRequest userRequest = lineUserRequest("line-access-token", 7200);
            OAuth2User delegateUser = new DefaultOAuth2User(
                    Collections.singleton(new SimpleGrantedAuthority("ROLE_USER")),
                    Map.of(
                            "userId", "U1234567890abcdef",
                            "email", "bob@example.com",
                            "displayName", "Bob"
                    ),
                    "userId"
            );
            when(delegate.loadUser(userRequest)).thenReturn(delegateUser);

            User returnedUser = newVerifiedUser(2L, "bob@example.com");
            when(helper.processOAuthUser(any(OAuth2UserInfo.class))).thenReturn(returnedUser);

            setSessionLang("en");

            service.loadUser(userRequest);

            ArgumentCaptor<OAuth2UserInfo> infoCaptor = ArgumentCaptor.forClass(OAuth2UserInfo.class);
            org.mockito.Mockito.verify(helper).processOAuthUser(infoCaptor.capture());
            OAuth2UserInfo capturedInfo = infoCaptor.getValue();

            assertThat(capturedInfo.provider()).isEqualTo(OAuthProvider.LINE);
            assertThat(capturedInfo.providerUserId()).isEqualTo("U1234567890abcdef");
            assertThat(capturedInfo.email()).isEqualTo("bob@example.com");
            assertThat(capturedInfo.accessToken()).isEqualTo("line-access-token");
            assertThat(capturedInfo.language()).isEqualTo("en");
        }
    }

    // ============================================================
    // HttpSession の lang 取り扱い
    // ============================================================

    @Test
    @DisplayName("HttpSession が無い場合は language=null で helper に渡す")
    void nullLanguageWhenNoSession() {
        OAuth2UserRequest userRequest = googleUserRequest("token", 3600);
        OAuth2User delegateUser = new DefaultOAuth2User(
                Collections.singleton(new SimpleGrantedAuthority("ROLE_USER")),
                Map.of("sub", "s1", "email", "a@b.com"),
                "sub"
        );
        when(delegate.loadUser(userRequest)).thenReturn(delegateUser);
        when(helper.processOAuthUser(any(OAuth2UserInfo.class)))
                .thenReturn(newVerifiedUser(10L, "a@b.com"));

        // RequestContextHolder.setRequestAttributes を呼ばないので null

        service.loadUser(userRequest);

        ArgumentCaptor<OAuth2UserInfo> c = ArgumentCaptor.forClass(OAuth2UserInfo.class);
        org.mockito.Mockito.verify(helper).processOAuthUser(c.capture());
        assertThat(c.getValue().language()).isNull();
    }

    // ============================================================
    // 例外の伝播
    // ============================================================

    @Test
    @DisplayName("helper が OAuth2AuthenticationException を投げたらそのまま再スローする")
    void propagatesAuthenticationExceptionFromHelper() {
        OAuth2UserRequest userRequest = googleUserRequest("token", 3600);
        OAuth2User delegateUser = new DefaultOAuth2User(
                Collections.singleton(new SimpleGrantedAuthority("ROLE_USER")),
                Map.of("sub", "s1", "email", "suspended@example.com"),
                "sub"
        );
        when(delegate.loadUser(userRequest)).thenReturn(delegateUser);

        OAuth2AuthenticationException ex = new OAuth2AuthenticationException(
                new OAuth2Error("USER_SUSPENDED", "suspended", null),
                "USER_SUSPENDED"
        );
        when(helper.processOAuthUser(any(OAuth2UserInfo.class))).thenThrow(ex);

        assertThatThrownBy(() -> service.loadUser(userRequest))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("USER_SUSPENDED");
    }

    // ============================================================
    // delegate が例外を投げるケース
    // ============================================================

    @Test
    @DisplayName("delegate の loadUser が OAuth2AuthenticationException を投げたらそのまま再スローする")
    void propagatesAuthenticationExceptionFromDelegate() {
        OAuth2UserRequest userRequest = googleUserRequest("token", 3600);
        OAuth2AuthenticationException ex = new OAuth2AuthenticationException(
                new OAuth2Error("invalid_token", "bad", null),
                "invalid_token"
        );
        when(delegate.loadUser(userRequest)).thenThrow(ex);

        assertThatThrownBy(() -> service.loadUser(userRequest))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("invalid_token");
    }

    // ============================================================
    // ヘルパー
    // ============================================================

    private static OAuth2UserRequest googleUserRequest(String tokenValue, long expiresInSeconds) {
        ClientRegistration registration = ClientRegistration.withRegistrationId("google")
                .clientId("test-client-id")
                .clientSecret("test-client-secret")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("http://localhost:8080/login/oauth2/code/google")
                .scope("openid", "email", "profile")
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .tokenUri("https://www.googleapis.com/oauth2/v4/token")
                .userInfoUri("https://www.googleapis.com/oauth2/v3/userinfo")
                .userNameAttributeName("sub")
                .clientName("Google")
                .build();

        OAuth2AccessToken token = new OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER,
                tokenValue,
                Instant.now(),
                Instant.now().plusSeconds(expiresInSeconds)
        );
        return new OAuth2UserRequest(registration, token);
    }

    private static OAuth2UserRequest lineUserRequest(String tokenValue, long expiresInSeconds) {
        ClientRegistration registration = ClientRegistration.withRegistrationId("line")
                .clientId("test-line-id")
                .clientSecret("test-line-secret")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("http://localhost:8080/login/oauth2/code/line")
                .scope("profile", "openid", "email")
                .authorizationUri("https://access.line.me/oauth2/v2.1/authorize")
                .tokenUri("https://api.line.me/oauth2/v2.1/token")
                .userInfoUri("https://api.line.me/v2/profile")
                .userNameAttributeName("userId")
                .clientName("LINE")
                .build();

        OAuth2AccessToken token = new OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER,
                tokenValue,
                Instant.now(),
                Instant.now().plusSeconds(expiresInSeconds)
        );
        return new OAuth2UserRequest(registration, token);
    }

    private static void setSessionLang(String lang) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.getSession().setAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG, lang);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    private static User newVerifiedUser(Long id, String email) {
        User user = new User("user_abc1234", email, null, CodeConstants.ROLE_USER);
        user.setId(id);
        user.setEmailVerified(true);
        return user;
    }
}
