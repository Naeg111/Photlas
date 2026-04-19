package com.photlas.backend.security;

import jakarta.servlet.http.HttpServletRequest;
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
 *
 * <p>Phase 3d Red 段階ではスケルトンのみで、resolve() は
 * {@link UnsupportedOperationException} を投げる。
 */
public class CustomOAuth2AuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    @SuppressWarnings("unused") // Phase 3d Green で参照
    private final OAuth2AuthorizationRequestResolver delegate;

    public CustomOAuth2AuthorizationRequestResolver(OAuth2AuthorizationRequestResolver delegate) {
        this.delegate = delegate;
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        throw new UnsupportedOperationException("CustomOAuth2AuthorizationRequestResolver.resolve(request) は未実装です（Phase 3d Green）");
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        throw new UnsupportedOperationException("CustomOAuth2AuthorizationRequestResolver.resolve(request, id) は未実装です（Phase 3d Green）");
    }
}
