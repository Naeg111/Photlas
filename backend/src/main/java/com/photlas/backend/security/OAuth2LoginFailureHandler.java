package com.photlas.backend.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Issue#81 Phase 3e - OAuth ログイン失敗時のハンドラ。
 *
 * <p>{@link OAuth2AuthenticationException} のエラーコードを
 * フラグメント {@code #error=<code>} に詰めて
 * {@code <frontendUrl>/oauth/callback} へリダイレクトする。
 * それ以外の {@link AuthenticationException} は汎用コード
 * {@code OAUTH_UNKNOWN_ERROR} にフォールバックする。
 *
 * <p>失敗時もセッションの {@link CustomOAuth2UserService#SESSION_ATTRIBUTE_LANG}
 * をクリアして、次回認可フローまで残さない。
 */
public class OAuth2LoginFailureHandler extends SimpleUrlAuthenticationFailureHandler {

    private static final String CALLBACK_PATH = "/oauth/callback";
    private static final String QUERY_KEY_ERROR = "error";
    static final String FALLBACK_ERROR_CODE = "OAUTH_UNKNOWN_ERROR";

    private final String frontendUrl;

    public OAuth2LoginFailureHandler(String frontendUrl) {
        this.frontendUrl = frontendUrl;
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception)
            throws IOException, ServletException {
        String errorCode = resolveErrorCode(exception);
        clearSessionLang(request);
        String target = buildRedirectUrl(errorCode);
        getRedirectStrategy().sendRedirect(request, response, target);
    }

    private static String resolveErrorCode(AuthenticationException exception) {
        if (exception instanceof OAuth2AuthenticationException oauthEx) {
            OAuth2Error err = oauthEx.getError();
            if (err != null && err.getErrorCode() != null && !err.getErrorCode().isBlank()) {
                return err.getErrorCode();
            }
        }
        return FALLBACK_ERROR_CODE;
    }

    private String buildRedirectUrl(String errorCode) {
        return frontendUrl + CALLBACK_PATH + '#' + QUERY_KEY_ERROR + '='
                + URLEncoder.encode(errorCode, StandardCharsets.UTF_8);
    }

    private static void clearSessionLang(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.removeAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG);
        }
    }
}
