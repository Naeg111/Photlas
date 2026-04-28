package com.photlas.backend.security;

import com.photlas.backend.dto.OAuth2UserInfo;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.service.OAuth2UserServiceHelper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.web.context.request.RequestContextHolder;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Issue#99 - {@link CustomOidcUserService} のテスト。
 *
 * LINE は OAuth スコープに {@code openid} を含むため、Spring Security は OIDC フローに
 * 切り替わる。OIDC フローでは ID トークンクレームから {@code sub} と {@code email} を
 * 取り出して {@link OAuth2UserServiceHelper} に渡す。user-info エンドポイントは
 * 呼ばずに ID トークンのみで OidcUser を構築する設計（{@code /v2/profile} で得られる
 * 追加情報は不要、かつ呼び出しが invalid_user_info_response を起こす場合があるため）。
 *
 * 検証項目:
 * <ul>
 *   <li>LINE: ID トークンの {@code sub} を providerUserId、{@code email} を email として helper に渡す</li>
 *   <li>access_token と有効期限をそのまま OAuth2UserInfo に渡す</li>
 *   <li>helper の戻り値 User を {@link PhotlasOidcUser} でラップして返し、{@link PhotlasOAuth2User} としても扱える</li>
 *   <li>helper が {@link OAuth2AuthenticationException} を投げた場合、そのまま再スローする</li>
 *   <li>ID トークンに sub が無い場合は {@code OAUTH_PROVIDER_USER_ID_REQUIRED} を投げる</li>
 *   <li>ID トークンに email が無い場合は {@code OAUTH_EMAIL_REQUIRED} を投げる</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class CustomOidcUserServiceTest {

    @Mock
    private OAuth2UserServiceHelper helper;

    private CustomOidcUserService service;

    @BeforeEach
    void setUp() {
        service = new CustomOidcUserService(helper);
    }

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    @DisplayName("LINE OIDC: ID トークンの sub を providerUserId、email を email として helper に渡す")
    void extractsSubAndEmailFromLineIdToken() {
        OidcIdToken idToken = newIdToken(Map.of(
                "sub", "U1234567890abcdef",
                "email", "bob@example.com",
                "name", "Bob"
        ));
        OidcUserRequest userRequest = lineOidcUserRequest(idToken, "line-access-token", 7200);

        User returnedUser = newVerifiedUser(2L, "bob@example.com");
        when(helper.processOAuthUser(any(OAuth2UserInfo.class))).thenReturn(returnedUser);

        OidcUser result = service.loadUser(userRequest);

        ArgumentCaptor<OAuth2UserInfo> infoCaptor = ArgumentCaptor.forClass(OAuth2UserInfo.class);
        verify(helper).processOAuthUser(infoCaptor.capture());
        OAuth2UserInfo capturedInfo = infoCaptor.getValue();

        assertThat(capturedInfo.provider()).isEqualTo(OAuthProvider.LINE);
        assertThat(capturedInfo.providerUserId()).isEqualTo("U1234567890abcdef");
        assertThat(capturedInfo.email()).isEqualTo("bob@example.com");
        assertThat(capturedInfo.accessToken()).isEqualTo("line-access-token");
        assertThat(capturedInfo.tokenExpiresAt()).isNotNull();

        // PhotlasOidcUser でラップされ、内部の User を取り出せる
        assertThat(result).isInstanceOf(PhotlasOidcUser.class);
        // SuccessHandler が PhotlasOAuth2User として扱えるよう、サブクラス関係になっている
        assertThat(result).isInstanceOf(PhotlasOAuth2User.class);
        PhotlasOidcUser photlasOidcUser = (PhotlasOidcUser) result;
        assertThat(photlasOidcUser.getUser()).isSameAs(returnedUser);
        // ID トークンを保持している
        assertThat(photlasOidcUser.getIdToken().getSubject()).isEqualTo("U1234567890abcdef");
    }

    @Test
    @DisplayName("helper が OAuth2AuthenticationException を投げたらそのまま再スローする")
    void propagatesAuthenticationExceptionFromHelper() {
        OidcIdToken idToken = newIdToken(Map.of("sub", "U1", "email", "suspended@example.com"));
        OidcUserRequest userRequest = lineOidcUserRequest(idToken, "token", 3600);

        OAuth2AuthenticationException ex = new OAuth2AuthenticationException(
                new OAuth2Error("USER_SUSPENDED", "suspended", null),
                "USER_SUSPENDED"
        );
        when(helper.processOAuthUser(any(OAuth2UserInfo.class))).thenThrow(ex);

        assertThatThrownBy(() -> service.loadUser(userRequest))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("USER_SUSPENDED");
    }

    @Test
    @DisplayName("ID トークンに sub が無い場合は OAUTH_PROVIDER_USER_ID_REQUIRED を投げる")
    void rejectsWhenSubMissing() {
        // sub が空文字のトークン（OidcIdToken は sub 必須なので、空文字で擬似的に欠落を表現）
        OidcIdToken idToken = newIdToken(Map.of("sub", "", "email", "x@example.com"));
        OidcUserRequest userRequest = lineOidcUserRequest(idToken, "token", 3600);

        assertThatThrownBy(() -> service.loadUser(userRequest))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("OAUTH_PROVIDER_USER_ID_REQUIRED");
    }

    @Test
    @DisplayName("ID トークンに email が無い場合は OAUTH_EMAIL_REQUIRED を投げる")
    void rejectsWhenEmailMissing() {
        OidcIdToken idToken = newIdToken(Map.of("sub", "U1"));  // email なし
        OidcUserRequest userRequest = lineOidcUserRequest(idToken, "token", 3600);

        assertThatThrownBy(() -> service.loadUser(userRequest))
                .isInstanceOf(OAuth2AuthenticationException.class)
                .hasMessageContaining("OAUTH_EMAIL_REQUIRED");
    }

    // ============================================================
    // ヘルパー
    // ============================================================

    private static OidcIdToken newIdToken(Map<String, Object> claims) {
        return new OidcIdToken(
                "raw-id-token",
                Instant.now(),
                Instant.now().plusSeconds(3600),
                claims
        );
    }

    private static OidcUserRequest lineOidcUserRequest(OidcIdToken idToken, String tokenValue, long expiresInSeconds) {
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
        return new OidcUserRequest(registration, token, idToken);
    }

    private static User newVerifiedUser(Long id, String email) {
        User user = new User("user_abc1234", email, null, CodeConstants.ROLE_USER);
        user.setId(id);
        user.setEmailVerified(true);
        return user;
    }
}
