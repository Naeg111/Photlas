package com.photlas.backend.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Issue#81 Phase 3d - {@link CustomOAuth2AuthorizationRequestResolver} のテスト（Red 段階）。
 *
 * <p>リゾルバは {@link OAuth2AuthorizationRequestResolver} を wrap し、クライアントから
 * 渡された {@code lang} パラメータを HttpSession に保存する役割を持つ。保存キーは
 * {@link CustomOAuth2UserService#SESSION_ATTRIBUTE_LANG}。
 *
 * <p>検証項目:
 * <ul>
 *   <li>lang=ja / lang=en が来たらセッションに保存する</li>
 *   <li>lang パラメータが無ければセッションは書き換えない</li>
 *   <li>未サポート言語（例: lang=xx）はセッションに保存しない</li>
 *   <li>delegate が null を返した（未マッチ）場合もリクエスト側の保存処理はスキップしない
 *       （lang は認可開始時に保存したいのでリゾルバが null を返しても）→ 今回の設計では null なら何もしない</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
class CustomOAuth2AuthorizationRequestResolverTest {

    @Mock
    private OAuth2AuthorizationRequestResolver delegate;

    private CustomOAuth2AuthorizationRequestResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new CustomOAuth2AuthorizationRequestResolver(delegate);
    }

    @Test
    @DisplayName("lang=ja パラメータがあれば HttpSession に保存する")
    void storesJapaneseLangInSession() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorization/google");
        request.setParameter("lang", "ja");
        OAuth2AuthorizationRequest authReq = sampleAuthRequest();
        when(delegate.resolve(request)).thenReturn(authReq);

        OAuth2AuthorizationRequest result = resolver.resolve(request);

        assertThat(result).isSameAs(authReq);
        assertThat(request.getSession().getAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG))
                .isEqualTo("ja");
    }

    @Test
    @DisplayName("lang=en パラメータがあれば HttpSession に保存する（clientRegistrationId 付き版）")
    void storesEnglishLangInSessionForRegistrationIdOverload() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorization/line");
        request.setParameter("lang", "en");
        OAuth2AuthorizationRequest authReq = sampleAuthRequest();
        when(delegate.resolve(eq(request), eq("line"))).thenReturn(authReq);

        OAuth2AuthorizationRequest result = resolver.resolve(request, "line");

        assertThat(result).isSameAs(authReq);
        assertThat(request.getSession().getAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG))
                .isEqualTo("en");
    }

    @Test
    @DisplayName("lang パラメータが無い場合はセッションに書き込まない")
    void noSessionWriteWhenLangMissing() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorization/google");
        when(delegate.resolve(request)).thenReturn(sampleAuthRequest());

        resolver.resolve(request);

        // セッションが存在しない、または属性が未設定であることを確認
        assertThat(request.getSession(false) == null
                || request.getSession(false).getAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG) == null)
                .isTrue();
    }

    @Test
    @DisplayName("サポート外の lang 値（例: xx）は保存しない")
    void doesNotStoreUnsupportedLang() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorization/google");
        request.setParameter("lang", "xx");
        when(delegate.resolve(request)).thenReturn(sampleAuthRequest());

        resolver.resolve(request);

        assertThat(request.getSession(false) == null
                || request.getSession(false).getAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG) == null)
                .isTrue();
    }

    @Test
    @DisplayName("delegate が null を返す場合はセッション操作をスキップする")
    void skipsSessionWhenDelegateReturnsNull() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorization/google");
        request.setParameter("lang", "ja");
        when(delegate.resolve(request)).thenReturn(null);

        OAuth2AuthorizationRequest result = resolver.resolve(request);

        assertThat(result).isNull();
        assertThat(request.getSession(false) == null
                || request.getSession(false).getAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG) == null)
                .isTrue();
    }

    @Test
    @DisplayName("delegate は 1 引数版と 2 引数版の両方が呼ばれる")
    void delegatesToBothResolverSignatures() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/oauth2/authorization/google");
        OAuth2AuthorizationRequest authReq = sampleAuthRequest();
        when(delegate.resolve(any(), any(String.class))).thenReturn(authReq);

        OAuth2AuthorizationRequest r2 = resolver.resolve(request, "google");
        assertThat(r2).isSameAs(authReq);
    }

    // ---------- テストヘルパー ----------

    private static OAuth2AuthorizationRequest sampleAuthRequest() {
        return OAuth2AuthorizationRequest.authorizationCode()
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .clientId("test-client-id")
                .redirectUri("http://localhost:8080/login/oauth2/code/google")
                .scopes(java.util.Set.of("openid", "email", "profile"))
                .state("test-state")
                .additionalParameters(java.util.Map.of())
                .authorizationRequestUri("https://accounts.google.com/o/oauth2/v2/auth?...")
                .attributes(java.util.Map.of())
                .build();
    }
}
