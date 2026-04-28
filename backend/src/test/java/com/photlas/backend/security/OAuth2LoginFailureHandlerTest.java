package com.photlas.backend.security;

import com.photlas.backend.entity.OAuthProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#81 Phase 3e - {@link OAuth2LoginFailureHandler} のテスト（Red 段階）。
 *
 * <p>OAuth ログインフローで {@link OAuth2AuthenticationException} が発生した場合、
 * エラーコードをフラグメント {@code #error=<code>} に含めて
 * {@code <frontendUrl>/oauth/callback} へリダイレクトする。
 */
class OAuth2LoginFailureHandlerTest {

    private static final String FRONTEND_URL = "https://photlas.jp";

    private OAuth2LoginFailureHandler handler;
    private MockHttpServletRequest request;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        handler = new OAuth2LoginFailureHandler(FRONTEND_URL);
        request = new MockHttpServletRequest();
        response = new MockHttpServletResponse();
    }

    @Test
    @DisplayName("OAuth2AuthenticationException はエラーコードを #error に詰めてリダイレクトする")
    void redirectsWithErrorCodeForOAuth2Exception() throws Exception {
        OAuth2Error error = new OAuth2Error("OAUTH_LINK_CONFIRMATION_REQUIRED",
                "既存アカウントとのリンク確認が必要です", null);
        OAuth2AuthenticationException ex = new OAuth2AuthenticationException(
                error, "OAUTH_LINK_CONFIRMATION_REQUIRED");

        handler.onAuthenticationFailure(request, response, ex);

        String redirect = response.getRedirectedUrl();
        assertThat(redirect).isNotNull();
        assertThat(redirect).startsWith(FRONTEND_URL + "/oauth/callback#");
        assertThat(redirect).contains("error=OAUTH_LINK_CONFIRMATION_REQUIRED");
    }

    @Test
    @DisplayName("USER_SUSPENDED エラーもフラグメントに乗せる")
    void redirectsWithSuspendedError() throws Exception {
        OAuth2Error error = new OAuth2Error("USER_SUSPENDED", "suspended", null);
        OAuth2AuthenticationException ex = new OAuth2AuthenticationException(error, "USER_SUSPENDED");

        handler.onAuthenticationFailure(request, response, ex);

        assertThat(response.getRedirectedUrl()).contains("error=USER_SUSPENDED");
    }

    @Test
    @DisplayName("OAuth2 以外の AuthenticationException では汎用エラーコードを使う")
    void redirectsWithGenericErrorForNonOauth2Exception() throws Exception {
        AuthenticationException ex = new BadCredentialsException("bad");

        handler.onAuthenticationFailure(request, response, ex);

        String redirect = response.getRedirectedUrl();
        assertThat(redirect).isNotNull();
        assertThat(redirect).startsWith(FRONTEND_URL + "/oauth/callback#");
        assertThat(redirect).contains("error=OAUTH_UNKNOWN_ERROR");
    }

    @Test
    @DisplayName("エラーコードに含まれる危険文字は URL エンコードされる")
    void urlEncodesDangerousErrorCodes() throws Exception {
        // 念のため空白や & を含めて、リダイレクト URL を壊さないことを確認
        OAuth2Error error = new OAuth2Error("error with space&=",
                "desc", null);
        OAuth2AuthenticationException ex = new OAuth2AuthenticationException(
                error, "error with space&=");

        handler.onAuthenticationFailure(request, response, ex);

        String redirect = response.getRedirectedUrl();
        assertThat(redirect).isNotNull();
        assertThat(redirect).doesNotContain(" ");
    }

    @Test
    @DisplayName("セッションに残った lang 属性もクリアする（失敗時）")
    void clearsSessionLangAttributeOnFailure() throws Exception {
        request.getSession().setAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG, "ja");

        OAuth2Error error = new OAuth2Error("ANY_ERROR", "d", null);
        OAuth2AuthenticationException ex = new OAuth2AuthenticationException(error, "ANY_ERROR");

        handler.onAuthenticationFailure(request, response, ex);

        assertThat(request.getSession().getAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG))
                .isNull();
    }

    /* ============================================================== */
    /* Issue#99 - OAuth2LinkConfirmationException 専用ハンドリング     */
    /* ============================================================== */

    @Test
    @DisplayName("Issue#99 - OAuth2LinkConfirmationException は #link_confirmation_token=... にリダイレクト（#error= ではない）")
    void redirectsWithLinkConfirmationTokenForLinkException() throws Exception {
        OAuth2LinkConfirmationException ex = new OAuth2LinkConfirmationException(
                "link-token-xyz", OAuthProvider.GOOGLE);

        handler.onAuthenticationFailure(request, response, ex);

        String redirect = response.getRedirectedUrl();
        assertThat(redirect).isNotNull();
        assertThat(redirect).startsWith(FRONTEND_URL + "/oauth/callback#");
        assertThat(redirect).contains("link_confirmation_token=link-token-xyz");
        assertThat(redirect).contains("provider=GOOGLE");
        // #error= フラグメントは含めない（ダイアログ表示フローのため）
        assertThat(redirect).doesNotContain("error=");
    }

    @Test
    @DisplayName("Issue#99 - LINE プロバイダの場合、provider=LINE がフラグメントに含まれる")
    void includesLineProviderInLinkConfirmationFragment() throws Exception {
        OAuth2LinkConfirmationException ex = new OAuth2LinkConfirmationException(
                "line-link-token-abc", OAuthProvider.LINE);

        handler.onAuthenticationFailure(request, response, ex);

        String redirect = response.getRedirectedUrl();
        assertThat(redirect).contains("link_confirmation_token=line-link-token-abc");
        assertThat(redirect).contains("provider=LINE");
    }

    @Test
    @DisplayName("Issue#99 - リンクトークン中の特殊文字は URL エンコードされる")
    void urlEncodesLinkConfirmationToken() throws Exception {
        // 通常 hex 64 文字なので発生しないが、防御的に URL エンコードを検証
        OAuth2LinkConfirmationException ex = new OAuth2LinkConfirmationException(
                "token with space&=", OAuthProvider.GOOGLE);

        handler.onAuthenticationFailure(request, response, ex);

        String redirect = response.getRedirectedUrl();
        assertThat(redirect).doesNotContain(" ");
        // & 単体は URL エンコードされて %26 になっているはず（リダイレクト URL の構造を壊さない）
        assertThat(redirect).contains("%26");
    }

    @Test
    @DisplayName("Issue#99 - OAuth2LinkConfirmationException でもセッションの lang 属性はクリアされる")
    void clearsSessionLangAttributeForLinkException() throws Exception {
        request.getSession().setAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG, "ja");
        OAuth2LinkConfirmationException ex = new OAuth2LinkConfirmationException(
                "tok", OAuthProvider.GOOGLE);

        handler.onAuthenticationFailure(request, response, ex);

        assertThat(request.getSession().getAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG))
                .isNull();
    }
}
