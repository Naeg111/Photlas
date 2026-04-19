package com.photlas.backend.security;

import com.photlas.backend.service.OAuth2UserServiceHelper;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;

/**
 * Issue#81 Phase 3c - Spring Security OAuth2 の {@link OAuth2UserService} カスタム実装。
 *
 * <p>処理フロー:
 * <ol>
 *   <li>注入された delegate（通常は {@code DefaultOAuth2UserService}）でプロバイダから {@link OAuth2User} を取得</li>
 *   <li>{@code registrationId} から {@link com.photlas.backend.entity.OAuthProvider} を特定し、
 *       属性キー（Google: {@code sub} / LINE: {@code userId}）に応じて
 *       {@link com.photlas.backend.dto.OAuth2UserInfo} に正規化</li>
 *   <li>HttpSession から {@link #SESSION_ATTRIBUTE_LANG} を読み取り、UI 側の言語設定を伝播</li>
 *   <li>{@link OAuth2UserServiceHelper#processOAuthUser} に委譲してユーザーの特定・作成・復旧を実行</li>
 *   <li>戻ってきた {@code User} を {@link PhotlasOAuth2User} でラップして返す（元 {@code OAuth2User} の
 *       attributes は保持）</li>
 * </ol>
 *
 * <p>Phase 3c Red 段階ではスケルトンのみで、{@link #loadUser} は {@link UnsupportedOperationException}
 * を投げる。Green 段階で本体実装を追加する。
 */
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    /**
     * {@code CustomOAuth2AuthorizationRequestResolver}（Phase 3d）が
     * HttpSession に lang パラメータを保存する際のキー。
     */
    public static final String SESSION_ATTRIBUTE_LANG = "photlas.oauth2.lang";

    @SuppressWarnings("unused") // Phase 3c Green で参照
    private final OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate;

    @SuppressWarnings("unused") // Phase 3c Green で参照
    private final OAuth2UserServiceHelper helper;

    public CustomOAuth2UserService(
            OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate,
            OAuth2UserServiceHelper helper) {
        this.delegate = delegate;
        this.helper = helper;
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        // Phase 3c Red: 本実装は Green 段階で追加。
        throw new UnsupportedOperationException("CustomOAuth2UserService.loadUser は未実装です（Phase 3c Green で実装予定）");
    }
}
