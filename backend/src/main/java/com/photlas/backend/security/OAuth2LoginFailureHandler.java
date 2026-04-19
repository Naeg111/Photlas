package com.photlas.backend.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationFailureHandler;

import java.io.IOException;

/**
 * Issue#81 Phase 3e - OAuth ログイン失敗時のハンドラ。
 *
 * <p>{@link org.springframework.security.oauth2.core.OAuth2AuthenticationException} のエラーコードを
 * フラグメント経由で {@code <frontendUrl>/oauth/callback#error=<code>} にリダイレクト。
 * それ以外の {@link AuthenticationException} は {@code OAUTH_UNKNOWN_ERROR} にフォールバック。
 *
 * <p>Phase 3e Red 段階ではスケルトンのみで、onAuthenticationFailure は
 * {@link UnsupportedOperationException} を投げる。
 */
public class OAuth2LoginFailureHandler extends SimpleUrlAuthenticationFailureHandler {

    @SuppressWarnings("unused") // Phase 3e Green で参照
    private final String frontendUrl;

    public OAuth2LoginFailureHandler(String frontendUrl) {
        this.frontendUrl = frontendUrl;
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
                                        AuthenticationException exception) throws IOException, ServletException {
        throw new UnsupportedOperationException("OAuth2LoginFailureHandler は未実装です（Phase 3e Green で実装予定）");
    }
}
