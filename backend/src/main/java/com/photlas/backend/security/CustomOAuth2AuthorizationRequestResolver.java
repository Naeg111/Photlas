package com.photlas.backend.security;

import com.photlas.backend.validation.LanguageValidator;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.HashMap;
import java.util.Map;

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
 * <p><strong>LINE 専用の追加処理</strong>: registrationId が {@code line} の場合、
 * 認可リクエスト URL に {@code disable_ios_auto_login=true} を付与する。これは iOS PWA
 * から LINE ログインを行う際、LINE 側の自動ログインが Universal Link で LINE アプリを
 * 起動してしまい、Cookie コンテキストが切断されて
 * {@code authorization_request_not_found} エラーになる問題への対策。
 * このパラメータを付けると iOS 上でアプリ起動・自動ログインが抑制され、
 * Safari 内のみで認証が完結するようになる（LINE 公式ドキュメント準拠）。
 */
public class CustomOAuth2AuthorizationRequestResolver implements OAuth2AuthorizationRequestResolver {

    /** フロントから送られてくる言語指定クエリパラメータ名 */
    private static final String LANG_PARAM = "lang";

    /** LINE Login 公式パラメータ: iOS の自動ログイン（≒ LINE アプリ起動）を抑制する */
    static final String LINE_DISABLE_IOS_AUTO_LOGIN_PARAM = "disable_ios_auto_login";

    /** 上記パラメータの値（true 固定） */
    static final String LINE_DISABLE_IOS_AUTO_LOGIN_VALUE = "true";

    /** LINE のクライアント登録 ID（application properties の registration.line に対応） */
    static final String LINE_REGISTRATION_ID = "line";

    private final OAuth2AuthorizationRequestResolver delegate;

    public CustomOAuth2AuthorizationRequestResolver(OAuth2AuthorizationRequestResolver delegate) {
        this.delegate = delegate;
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request) {
        OAuth2AuthorizationRequest authorizationRequest = delegate.resolve(request);
        if (authorizationRequest == null) {
            return null;
        }
        storeLangInSession(request);
        return customizeForLineIfNeeded(authorizationRequest);
    }

    @Override
    public OAuth2AuthorizationRequest resolve(HttpServletRequest request, String clientRegistrationId) {
        OAuth2AuthorizationRequest authorizationRequest = delegate.resolve(request, clientRegistrationId);
        if (authorizationRequest == null) {
            return null;
        }
        storeLangInSession(request);
        return customizeForLineIfNeeded(authorizationRequest);
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

    /**
     * registrationId が LINE の場合のみ、認可リクエスト URL とパラメータマップに
     * {@code disable_ios_auto_login=true} を追加する。それ以外はそのまま返す。
     */
    private OAuth2AuthorizationRequest customizeForLineIfNeeded(OAuth2AuthorizationRequest authorizationRequest) {
        Object registrationId = authorizationRequest.getAttribute(OAuth2ParameterNames.REGISTRATION_ID);
        if (!LINE_REGISTRATION_ID.equals(registrationId)) {
            return authorizationRequest;
        }

        Map<String, Object> additionalParameters = new HashMap<>(authorizationRequest.getAdditionalParameters());
        additionalParameters.put(LINE_DISABLE_IOS_AUTO_LOGIN_PARAM, LINE_DISABLE_IOS_AUTO_LOGIN_VALUE);

        String customizedUri = UriComponentsBuilder
                .fromUriString(authorizationRequest.getAuthorizationRequestUri())
                .queryParam(LINE_DISABLE_IOS_AUTO_LOGIN_PARAM, LINE_DISABLE_IOS_AUTO_LOGIN_VALUE)
                .build(true)
                .toUriString();

        return OAuth2AuthorizationRequest.from(authorizationRequest)
                .additionalParameters(additionalParameters)
                .authorizationRequestUri(customizedUri)
                .build();
    }
}
