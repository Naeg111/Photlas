package com.photlas.backend.security;

import com.photlas.backend.service.JwtService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;

import java.io.IOException;

/**
 * Issue#81 Phase 3e - OAuth ログイン成功時のハンドラ。
 *
 * <p>認証成功後、{@link PhotlasOAuth2User} から {@code User} を取り出し、
 * {@link JwtService} で JWT を発行。ブラウザ履歴・サーバログに残さないため
 * フラグメント（{@code #}）経由でフロントへ渡す。
 *
 * <ul>
 *   <li>通常: {@code <frontendUrl>/oauth/callback#access_token=<jwt>}</li>
 *   <li>仮ユーザー名: 上記に {@code &requires_username_setup=true} 付与</li>
 * </ul>
 *
 * <p>Phase 3e Red 段階ではスケルトンのみで、onAuthenticationSuccess は
 * {@link UnsupportedOperationException} を投げる。
 */
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    @SuppressWarnings("unused") // Phase 3e Green で参照
    private final JwtService jwtService;

    @SuppressWarnings("unused") // Phase 3e Green で参照
    private final String frontendUrl;

    public OAuth2LoginSuccessHandler(JwtService jwtService, String frontendUrl) {
        this.jwtService = jwtService;
        this.frontendUrl = frontendUrl;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        throw new UnsupportedOperationException("OAuth2LoginSuccessHandler は未実装です（Phase 3e Green で実装予定）");
    }
}
