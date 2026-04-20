package com.photlas.backend.config;

import com.photlas.backend.security.CustomOAuth2AuthorizationRequestResolver;
import com.photlas.backend.security.CustomOAuth2UserService;
import com.photlas.backend.security.OAuth2LoginFailureHandler;
import com.photlas.backend.security.OAuth2LoginSuccessHandler;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#81 Phase 3f - {@code photlas.oauth.enabled=true} 時の Spring Security OAuth2 設定検証。
 *
 * <p>技術設計書 §3.13 / 手順書 Phase 3f の仕様:
 * <ul>
 *   <li>Authorization endpoint base URI: {@code /api/v1/auth/oauth2/authorization}</li>
 *   <li>Redirection (callback) endpoint base URI: {@code /api/v1/auth/oauth2/callback/*}</li>
 *   <li>{@code securityMatcher("/api/v1/auth/oauth2/**")} でスコープを限定</li>
 *   <li>{@code @Order(1)} で既存 SecurityConfig より先に評価</li>
 *   <li>{@code SessionCreationPolicy.IF_REQUIRED}（OAuth state 管理のため）</li>
 * </ul>
 *
 * <p>ダミーの client-id / client-secret を渡すことで Spring Boot 自動設定に
 * {@code InMemoryClientRegistrationRepository} を用意させ、実際にプロバイダー API を
 * 叩くことなく Spring Security の認可リダイレクトフローだけを検証する。
 */
@SpringBootTest(properties = {
        "photlas.oauth.enabled=true",
        // Google OAuth2 クライアント（ダミー値、テストでは実プロバイダーを叩かない）
        "spring.security.oauth2.client.registration.google.client-id=dummy-google-id",
        "spring.security.oauth2.client.registration.google.client-secret=dummy-google-secret",
        "spring.security.oauth2.client.registration.google.scope=email,profile",
        "spring.security.oauth2.client.registration.google.redirect-uri={baseUrl}/api/v1/auth/oauth2/callback/google",
        // LINE OAuth2 クライアント（ダミー値）
        "spring.security.oauth2.client.registration.line.client-id=dummy-line-id",
        "spring.security.oauth2.client.registration.line.client-secret=dummy-line-secret",
        "spring.security.oauth2.client.registration.line.scope=profile,openid,email",
        "spring.security.oauth2.client.registration.line.authorization-grant-type=authorization_code",
        "spring.security.oauth2.client.registration.line.redirect-uri={baseUrl}/api/v1/auth/oauth2/callback/line",
        "spring.security.oauth2.client.registration.line.client-authentication-method=client_secret_post",
        // LINE は Spring Boot 組み込み provider ではないので手動定義
        "spring.security.oauth2.client.provider.line.authorization-uri=https://access.line.me/oauth2/v2.1/authorize",
        "spring.security.oauth2.client.provider.line.token-uri=https://api.line.me/oauth2/v2.1/token",
        "spring.security.oauth2.client.provider.line.user-info-uri=https://api.line.me/v2/profile",
        "spring.security.oauth2.client.provider.line.user-name-attribute=userId"
})
@ActiveProfiles("test")
@AutoConfigureMockMvc
@DisplayName("Issue#81 Phase 3f - OAuth 有効時の Spring Security 設定")
class OAuth2SecurityConfigEnabledTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ApplicationContext ctx;

    // ---------- Bean 生成 ----------

    @Test
    @DisplayName("OAuth 有効時は OAuth2SecurityConfig Bean が登録される")
    void oauthEnabled_configBeanLoaded() {
        assertThat(ctx.containsBean("oAuth2SecurityConfig")).isTrue();
    }

    @Test
    @DisplayName("OAuth 有効時は CustomOAuth2UserService Bean が登録される")
    void oauthEnabled_customOAuth2UserServiceRegistered() {
        assertThat(ctx.getBeanNamesForType(CustomOAuth2UserService.class)).isNotEmpty();
    }

    @Test
    @DisplayName("OAuth 有効時は CustomOAuth2AuthorizationRequestResolver Bean が登録される")
    void oauthEnabled_customResolverRegistered() {
        assertThat(ctx.getBeanNamesForType(CustomOAuth2AuthorizationRequestResolver.class)).isNotEmpty();
    }

    @Test
    @DisplayName("OAuth 有効時は OAuth2LoginSuccessHandler / OAuth2LoginFailureHandler Bean が登録される")
    void oauthEnabled_loginHandlersRegistered() {
        assertThat(ctx.getBeanNamesForType(OAuth2LoginSuccessHandler.class)).isNotEmpty();
        assertThat(ctx.getBeanNamesForType(OAuth2LoginFailureHandler.class)).isNotEmpty();
    }

    @Test
    @DisplayName("OAuth 用フィルタチェインが追加登録される (SecurityFilterChain 2 件以上)")
    void oauthEnabled_multipleSecurityFilterChainsRegistered() {
        String[] names = ctx.getBeanNamesForType(SecurityFilterChain.class);
        assertThat(names).hasSizeGreaterThanOrEqualTo(2);
    }

    // ---------- 認可エンドポイント（カスタム base URI） ----------

    @Test
    @DisplayName("GET /api/v1/auth/oauth2/authorization/google は Google 認可 URL へ 302 リダイレクト")
    void googleAuthorizationEndpoint_redirectsToGoogle() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/auth/oauth2/authorization/google"))
                .andExpect(status().is3xxRedirection())
                .andReturn();
        String location = result.getResponse().getHeader("Location");
        assertThat(location).isNotNull();
        assertThat(location).startsWith("https://accounts.google.com/");
        assertThat(location).contains("client_id=dummy-google-id");
        // redirect_uri は URL エンコードされて埋め込まれる
        String decoded = URLDecoder.decode(location, StandardCharsets.UTF_8);
        assertThat(decoded).contains("/api/v1/auth/oauth2/callback/google");
    }

    @Test
    @DisplayName("GET /api/v1/auth/oauth2/authorization/line は LINE 認可 URL へ 302 リダイレクト")
    void lineAuthorizationEndpoint_redirectsToLine() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/auth/oauth2/authorization/line"))
                .andExpect(status().is3xxRedirection())
                .andReturn();
        String location = result.getResponse().getHeader("Location");
        assertThat(location).isNotNull();
        assertThat(location).startsWith("https://access.line.me/oauth2/v2.1/authorize");
        assertThat(location).contains("client_id=dummy-line-id");
        String decoded = URLDecoder.decode(location, StandardCharsets.UTF_8);
        assertThat(decoded).contains("/api/v1/auth/oauth2/callback/line");
    }

    @Test
    @DisplayName("Spring デフォルトパス /oauth2/authorization/google は OAuth フィルタに吸い込まれない")
    void springDefaultAuthorizationPath_notHandledByOAuthChain() throws Exception {
        MvcResult result = mockMvc.perform(get("/oauth2/authorization/google")).andReturn();
        String location = result.getResponse().getHeader("Location");
        // OAuth フィルタチェインの securityMatcher は /api/v1/auth/oauth2/** のみなので、
        // 既存 SecurityConfig の filter chain で処理される。Google へ 302 にはならない。
        if (result.getResponse().getStatus() == 302 && location != null) {
            assertThat(location).doesNotStartWith("https://accounts.google.com/");
        }
    }

    // ---------- リゾルバ経由の lang 保存 ----------

    @Test
    @DisplayName("lang クエリパラメータが HttpSession に保存される (CustomOAuth2AuthorizationRequestResolver 配線)")
    void langParamSavedToSessionDuringAuthorizationRequest() throws Exception {
        MockHttpSession session = new MockHttpSession();
        mockMvc.perform(get("/api/v1/auth/oauth2/authorization/google")
                        .param("lang", "ja")
                        .session(session))
                .andExpect(status().is3xxRedirection());
        assertThat(session.getAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG))
                .as("CustomOAuth2AuthorizationRequestResolver が HttpSession に lang を保存すること")
                .isEqualTo("ja");
    }

    // ---------- セッションポリシー ----------

    @Test
    @DisplayName("SessionCreationPolicy=IF_REQUIRED: OAuth 認可リクエスト時にセッションが作成される")
    void sessionPolicyIsIfRequired_sessionCreatedOnAuthorizationRequest() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/auth/oauth2/authorization/google"))
                .andExpect(status().is3xxRedirection())
                .andReturn();
        HttpSession session = result.getRequest().getSession(false);
        assertThat(session)
                .as("IF_REQUIRED なので OAuth state 管理のためセッションが自動作成される")
                .isNotNull();
    }

    // ---------- 非 OAuth パスの既存チェイン側処理 ----------

    @Test
    @DisplayName("非 OAuth パス (/api/v1/health) は既存 SecurityConfig のチェインで処理される")
    void nonOAuthPath_handledByMainFilterChain() throws Exception {
        mockMvc.perform(get("/api/v1/health")).andExpect(status().isOk());
    }
}
