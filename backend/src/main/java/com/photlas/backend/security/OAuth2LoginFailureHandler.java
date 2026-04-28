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
 * Issue#81 Phase 3e / Issue#99 - OAuth ログイン失敗時のハンドラ。
 *
 * <p>通常の {@link OAuth2AuthenticationException} はエラーコードを
 * フラグメント {@code #error=<code>} に詰めて
 * {@code <frontendUrl>/oauth/callback} へリダイレクトする。
 * それ以外の {@link AuthenticationException} は汎用コード
 * {@code OAUTH_UNKNOWN_ERROR} にフォールバックする。
 *
 * <p>Issue#99 - 例外が {@link OAuth2LinkConfirmationException} の場合は
 * エラー扱いではなくリンク確認フロー扱いとし、
 * {@code #link_confirmation_token=<token>&provider=<PROVIDER>} 形式で
 * リダイレクトする。フロントエンドはこれを検出して
 * {@code LinkAccountConfirmDialog} を開く。
 *
 * <p>失敗時もセッションの {@link CustomOAuth2UserService#SESSION_ATTRIBUTE_LANG}
 * をクリアして、次回認可フローまで残さない。
 */
public class OAuth2LoginFailureHandler extends SimpleUrlAuthenticationFailureHandler {

    private static final String CALLBACK_PATH = "/oauth/callback";
    private static final String QUERY_KEY_ERROR = "error";
    private static final String QUERY_KEY_LINK_CONFIRMATION_TOKEN = "link_confirmation_token";
    private static final String QUERY_KEY_PROVIDER = "provider";
    static final String FALLBACK_ERROR_CODE = "OAUTH_UNKNOWN_ERROR";

    private final String frontendUrl;

    public OAuth2LoginFailureHandler(String frontendUrl) {
        this.frontendUrl = frontendUrl;
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception)
            throws IOException, ServletException {
        clearSessionLang(request);
        String target = (exception instanceof OAuth2LinkConfirmationException linkEx)
                ? buildLinkConfirmationUrl(linkEx)
                : buildErrorUrl(resolveErrorCode(exception));
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

    private String buildErrorUrl(String errorCode) {
        return frontendUrl + CALLBACK_PATH + '#' + QUERY_KEY_ERROR + '='
                + URLEncoder.encode(errorCode, StandardCharsets.UTF_8);
    }

    private String buildLinkConfirmationUrl(OAuth2LinkConfirmationException ex) {
        String token = URLEncoder.encode(ex.getLinkConfirmationToken(), StandardCharsets.UTF_8);
        String provider = URLEncoder.encode(ex.getProvider().name(), StandardCharsets.UTF_8);
        return frontendUrl + CALLBACK_PATH + '#'
                + QUERY_KEY_LINK_CONFIRMATION_TOKEN + '=' + token
                + '&' + QUERY_KEY_PROVIDER + '=' + provider;
    }

    private static void clearSessionLang(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.removeAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG);
        }
    }
}
