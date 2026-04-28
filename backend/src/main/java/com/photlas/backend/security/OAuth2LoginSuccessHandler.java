package com.photlas.backend.security;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.service.JwtService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * Issue#81 Phase 3e - OAuth ログイン成功時のハンドラ。
 *
 * <p>認証成功後、{@link PhotlasOAuth2User} から {@code User} を取り出し、
 * {@link JwtService} で JWT を発行。ブラウザ履歴・サーバログに残さないため
 * フラグメント（{@code #}）経由でフロントへ渡す。
 *
 * <ul>
 *   <li>通常: {@code <frontendUrl>/oauth/callback#access_token=<jwt>}</li>
 *   <li>仮表示名: 上記に {@code &requires_username_setup=true} 付与</li>
 * </ul>
 *
 * <p>成功時は HttpSession の {@link CustomOAuth2UserService#SESSION_ATTRIBUTE_LANG}
 * を明示的にクリアし、次回認可フローまでリークさせない。
 */
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final String CALLBACK_PATH = "/oauth/callback";
    private static final String QUERY_KEY_ACCESS_TOKEN = "access_token";
    private static final String QUERY_KEY_REQUIRES_USERNAME_SETUP = "requires_username_setup";

    private final JwtService jwtService;
    private final String frontendUrl;

    public OAuth2LoginSuccessHandler(JwtService jwtService, String frontendUrl) {
        this.jwtService = jwtService;
        this.frontendUrl = frontendUrl;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        Object principal = authentication.getPrincipal();
        if (!(principal instanceof PhotlasOAuth2User photlasUser)) {
            throw new IllegalStateException(
                    "認証 Principal が PhotlasOAuth2User ではありません: "
                            + (principal == null ? "null" : principal.getClass().getName()));
        }

        User user = photlasUser.getUser();
        String jwt = jwtService.generateTokenWithRole(
                user.getEmail(),
                CodeConstants.roleToJwtString(user.getRole())
        );

        clearSessionLang(request);

        String target = buildRedirectUrl(jwt, user.isUsernameTemporary());
        getRedirectStrategy().sendRedirect(request, response, target);
    }

    private String buildRedirectUrl(String jwt, boolean usernameTemporary) {
        StringBuilder sb = new StringBuilder(frontendUrl);
        sb.append(CALLBACK_PATH).append('#');
        sb.append(QUERY_KEY_ACCESS_TOKEN).append('=')
                .append(URLEncoder.encode(jwt, StandardCharsets.UTF_8));
        if (usernameTemporary) {
            sb.append('&').append(QUERY_KEY_REQUIRES_USERNAME_SETUP).append("=true");
        }
        return sb.toString();
    }

    private static void clearSessionLang(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.removeAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG);
        }
    }
}
