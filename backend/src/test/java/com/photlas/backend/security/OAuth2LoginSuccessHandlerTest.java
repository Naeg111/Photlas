package com.photlas.backend.security;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.Collections;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Issue#81 Phase 3e - {@link OAuth2LoginSuccessHandler} のテスト（Red 段階）。
 *
 * <p>{@link PhotlasOAuth2User} から {@link User} を取り出し、
 * {@link JwtService#generateTokenWithRole} で JWT を発行する。
 * ブラウザ履歴・サーバログに残さないためフラグメント（#）で返す。
 *
 * <p>リダイレクト先フォーマット:
 * <ul>
 *   <li>通常ログイン: {@code <frontendUrl>/oauth/callback#access_token=<jwt>}</li>
 *   <li>仮ユーザー名: {@code <frontendUrl>/oauth/callback#access_token=<jwt>&requires_username_setup=true}</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class OAuth2LoginSuccessHandlerTest {

    private static final String FRONTEND_URL = "https://photlas.jp";

    @Mock
    private JwtService jwtService;

    @Mock
    private Authentication authentication;

    private OAuth2LoginSuccessHandler handler;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        handler = new OAuth2LoginSuccessHandler(jwtService, FRONTEND_URL);
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
    }

    @Test
    @DisplayName("通常ユーザー: access_token をフラグメントに付けて /oauth/callback へリダイレクトする")
    void redirectsWithAccessTokenForRegularUser() throws Exception {
        User user = newUser(1L, "alice@example.com", false);
        PhotlasOAuth2User principal = new PhotlasOAuth2User(user, Map.of("email", user.getEmail()));
        when(authentication.getPrincipal()).thenReturn(principal);
        when(jwtService.generateTokenWithRole(user.getEmail(), CodeConstants.roleToJwtString(user.getRole())))
                .thenReturn("jwt-token-abc.xyz");

        handler.onAuthenticationSuccess(request, response, authentication);

        String redirect = response.getRedirectedUrl();
        assertThat(redirect).isNotNull();
        assertThat(redirect).startsWith(FRONTEND_URL + "/oauth/callback#");
        assertThat(redirect).contains("access_token=jwt-token-abc.xyz");
        assertThat(redirect).doesNotContain("requires_username_setup");
    }

    @Test
    @DisplayName("仮ユーザー名: requires_username_setup=true も付与する")
    void redirectsWithRequiresUsernameSetupForTemporaryUser() throws Exception {
        User user = newUser(2L, "bob@example.com", true);
        PhotlasOAuth2User principal = new PhotlasOAuth2User(user, Map.of("email", user.getEmail()));
        when(authentication.getPrincipal()).thenReturn(principal);
        when(jwtService.generateTokenWithRole(anyString(), anyString())).thenReturn("jwt-for-bob");

        handler.onAuthenticationSuccess(request, response, authentication);

        String redirect = response.getRedirectedUrl();
        assertThat(redirect).isNotNull();
        assertThat(redirect).startsWith(FRONTEND_URL + "/oauth/callback#");
        assertThat(redirect).contains("access_token=jwt-for-bob");
        assertThat(redirect).contains("requires_username_setup=true");
    }

    @Test
    @DisplayName("Principal が PhotlasOAuth2User でない場合は IllegalStateException を投げる")
    void throwsWhenPrincipalIsNotPhotlasUser() {
        when(authentication.getPrincipal()).thenReturn("not-a-photlas-user");

        assertThatThrownBy(() -> handler.onAuthenticationSuccess(request, response, authentication))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("PhotlasOAuth2User");
    }

    @Test
    @DisplayName("成功時は HttpSession の lang 属性をクリアする")
    void clearsSessionLangAttributeOnSuccess() throws Exception {
        User user = newUser(3L, "c@example.com", false);
        PhotlasOAuth2User principal = new PhotlasOAuth2User(user, Map.of("email", user.getEmail()));
        when(authentication.getPrincipal()).thenReturn(principal);
        when(jwtService.generateTokenWithRole(anyString(), anyString())).thenReturn("jwt");

        request.getSession().setAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG, "ja");
        assertThat(request.getSession().getAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG))
                .isEqualTo("ja");

        handler.onAuthenticationSuccess(request, response, authentication);

        assertThat(request.getSession().getAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG))
                .isNull();
    }

    // ---------- テストヘルパー ----------

    private static User newUser(Long id, String email, boolean temporary) {
        User user = new User("user_abcdefg", email, null, CodeConstants.ROLE_USER);
        user.setId(id);
        user.setEmailVerified(true);
        user.setUsernameTemporary(temporary);
        return user;
    }

    @SuppressWarnings("unused")
    private static PhotlasOAuth2User photlasUser(User user) {
        return new PhotlasOAuth2User(user, Collections.emptyMap());
    }

    @SuppressWarnings("unused")
    private static SimpleGrantedAuthority userAuthority() {
        return new SimpleGrantedAuthority("ROLE_USER");
    }
}
