package com.photlas.backend.security;

import com.photlas.backend.validation.LanguageValidator;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

/**
 * Issue#81 Phase 3d - {@link OAuth2AuthorizationRequestResolver} のカスタム実装。
 *
 * <p>OAuth 認可リクエスト開始時（{@code /oauth2/authorization/{registrationId}}）に
 * フロントエンドから渡される {@code lang} クエリパラメータを HttpSession に保存する。
 * 保存キーは {@link CustomOAuth2UserService#SESSION_ATTRIBUTE_LANG}。
 * {@link CustomOAuth2UserService} がコールバック時に読み取り、
 * 新規ユーザー作成時の初期言語として使う。
 *
 * <p>未サポート言語（ホワイトリスト外）・lang 欠落・delegate が null を返す場合は
 * セッションへの書き込みをスキップする。
 */
public class CustomOAuth2AuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    /** フロントから送られてくる言語指定クエリパラメータ名 */
    private static final String LANG_PARAM = "lang";

    private final OAuth2AuthorizationRequestResolver delegate;

    public CustomOAuth2AuthorizationRequestResolver(OAuth2AuthorizationRequestResolver delegate) {
        this.delegate = delegate;
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        OAuth2AuthorizationRequest authorizationRequest = delegate.resolve(request);
        if (authorizationRequest != null) {
            storeLangInSession(request);
        }
        return authorizationRequest;
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        OAuth2AuthorizationRequest authorizationRequest = delegate.resolve(request, clientRegistrationId);
        if (authorizationRequest != null) {
            storeLangInSession(request);
        }
        return authorizationRequest;
    }

    /**
     * リクエストから {@code lang} パラメータを取り出し、ホワイトリスト一致時のみ HttpSession に保存する。
     * 未サポート言語・null・空文字は保存しない（Accept-Language 等でフォールバックさせるため）。
     */
    private void storeLangInSession(HttpServletRequest request) {
        String lang = request.getParameter(LANG_PARAM);
        if (!LanguageValidator.isValid(lang)) {
            return;
        }
        HttpSession session = request.getSession(true);
        session.setAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG, lang);
    }
}
