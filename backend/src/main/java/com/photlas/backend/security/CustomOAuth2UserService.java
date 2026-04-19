package com.photlas.backend.security;

import com.photlas.backend.dto.OAuth2UserInfo;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.service.OAuth2UserServiceHelper;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Objects;

/**
 * Issue#81 Phase 3c - Spring Security OAuth2 の {@link OAuth2UserService} カスタム実装。
 *
 * <p>処理フロー:
 * <ol>
 *   <li>注入された delegate（通常は {@code DefaultOAuth2UserService}）でプロバイダから {@link OAuth2User} を取得</li>
 *   <li>{@code registrationId} から {@link OAuthProvider} を特定し、属性キー
 *       （Google: {@code sub} / LINE: {@code userId}）に応じて {@link OAuth2UserInfo} に正規化</li>
 *   <li>HttpSession から {@link #SESSION_ATTRIBUTE_LANG} を読み取り、UI 側の言語設定を伝播</li>
 *   <li>{@link OAuth2UserServiceHelper#processOAuthUser} に委譲してユーザーの特定・作成・復旧を実行</li>
 *   <li>戻ってきた {@code User} を {@link PhotlasOAuth2User} でラップして返す（元 {@code OAuth2User} の
 *       attributes は保持）</li>
 * </ol>
 */
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {

    /**
     * {@code CustomOAuth2AuthorizationRequestResolver}（Phase 3d）が
     * HttpSession に lang パラメータを保存する際のキー。
     */
    public static final String SESSION_ATTRIBUTE_LANG = "photlas.oauth2.lang";

    // Google の userInfo レスポンスにおける必須属性キー
    private static final String GOOGLE_SUB = "sub";
    private static final String GOOGLE_EMAIL = "email";

    // LINE の userInfo レスポンスにおける必須属性キー
    private static final String LINE_USER_ID = "userId";
    private static final String LINE_EMAIL = "email";

    private final OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate;
    private final OAuth2UserServiceHelper helper;

    public CustomOAuth2UserService(
            OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate,
            OAuth2UserServiceHelper helper) {
        this.delegate = delegate;
        this.helper = helper;
    }

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        // 1. delegate でプロバイダからユーザー情報を取得。OAuth2AuthenticationException は
        //    そのまま Spring Security の失敗ハンドラに伝播させる。
        OAuth2User oAuth2User = delegate.loadUser(userRequest);

        // 2. registrationId → OAuthProvider
        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        OAuthProvider provider;
        try {
            provider = OAuthProvider.fromRegistrationId(registrationId);
        } catch (IllegalArgumentException e) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("OAUTH_UNSUPPORTED_PROVIDER",
                            "サポートされていない OAuth プロバイダです: " + registrationId, null),
                    "OAUTH_UNSUPPORTED_PROVIDER"
            );
        }

        // 3. プロバイダに応じた属性抽出
        Map<String, Object> attributes = oAuth2User.getAttributes();
        String providerUserId = extractProviderUserId(provider, attributes);
        String email = extractEmail(provider, attributes);

        // 4. access_token + 有効期限（Instant → LocalDateTime[UTC]）
        OAuth2AccessToken accessToken = userRequest.getAccessToken();
        String tokenValue = accessToken != null ? accessToken.getTokenValue() : null;
        LocalDateTime tokenExpiresAt = toLocalDateTimeUtc(
                accessToken != null ? accessToken.getExpiresAt() : null);

        // 5. HttpSession から lang を取得（未設定なら null）
        String language = readLanguageFromSession();

        OAuth2UserInfo info = new OAuth2UserInfo(
                provider,
                providerUserId,
                email,
                tokenValue,
                tokenExpiresAt,
                language
        );

        // 6. helper に委譲
        User user = helper.processOAuthUser(info);

        // 7. PhotlasOAuth2User にラップ（元 attributes を保持）
        return new PhotlasOAuth2User(user, attributes);
    }

    // ---------- 属性抽出 ----------

    private static String extractProviderUserId(OAuthProvider provider, Map<String, Object> attributes) {
        String key = (provider == OAuthProvider.GOOGLE) ? GOOGLE_SUB : LINE_USER_ID;
        Object value = attributes.get(key);
        if (value == null || value.toString().isBlank()) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("OAUTH_PROVIDER_USER_ID_REQUIRED",
                            "OAuth プロバイダから " + key + " を取得できませんでした", null),
                    "OAUTH_PROVIDER_USER_ID_REQUIRED"
            );
        }
        return value.toString();
    }

    private static String extractEmail(OAuthProvider provider, Map<String, Object> attributes) {
        String key = (provider == OAuthProvider.GOOGLE) ? GOOGLE_EMAIL : LINE_EMAIL;
        Object value = attributes.get(key);
        if (value == null || value.toString().isBlank()) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("OAUTH_EMAIL_REQUIRED",
                            "OAuth プロバイダから email を取得できませんでした", null),
                    "OAUTH_EMAIL_REQUIRED"
            );
        }
        return value.toString();
    }

    // ---------- HttpSession から lang 取得 ----------

    /**
     * 現在のリクエストスコープの HttpSession から言語コードを取得する。
     * {@code RequestContextHolder} にリクエスト属性が設定されていない場合、
     * セッションが存在しない場合、属性が未設定の場合はいずれも {@code null} を返す。
     */
    private static String readLanguageFromSession() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (!(attrs instanceof ServletRequestAttributes servletAttrs)) {
            return null;
        }
        HttpSession session = servletAttrs.getRequest().getSession(false);
        if (session == null) {
            return null;
        }
        Object lang = session.getAttribute(SESSION_ATTRIBUTE_LANG);
        return lang != null ? Objects.toString(lang, null) : null;
    }

    // ---------- Instant → LocalDateTime[UTC] ----------

    private static LocalDateTime toLocalDateTimeUtc(Instant instant) {
        return instant == null ? null : LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
