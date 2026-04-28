package com.photlas.backend.security;

import com.photlas.backend.dto.OAuth2UserInfo;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.service.OAuth2UserServiceHelper;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.oidc.userinfo.OidcUserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Issue#99 - OIDC フロー（scope に {@code openid} を含むプロバイダ）用の
 * {@link OAuth2UserService} 実装。
 *
 * <p>LINE は {@code openid} を含む scope を必須とし、メールアドレスは ID トークン
 * クレーム経由でしか取得できないため OIDC フローを通る。本サービスは
 * Spring の OIDC ID トークン署名検証後に呼び出され、ID トークンクレームから
 * {@code sub} と {@code email} を取り出して {@link OAuth2UserServiceHelper#processOAuthUser}
 * に委譲する。
 *
 * <p>Spring 標準の {@code OidcUserService} は内部で user-info エンドポイント
 * （LINE では {@code /v2/profile}）も呼び出すが、Photlas が必要とする情報は
 * すべて ID トークンクレームに含まれているため、user-info 呼び出しは行わない。
 * （LINE の {@code /v2/profile} は {@code email} を返さず、追加で得られるのは
 * {@code displayName} 等のみ。{@code displayName} は仮表示名生成があるため不要）
 *
 * <p>Google は scope に {@code openid} を含めない設計（最小権限の原則 + Issue#99 で削除済み）
 * のため OIDC フローには入らず、{@link CustomOAuth2UserService} で処理される。
 */
public class CustomOidcUserService implements OAuth2UserService<OidcUserRequest, OidcUser> {

    /**
     * OIDC は ID トークンの {@code sub} クレームを必ず含むため、これを name 属性キーとする。
     * これによりプロバイダの user-info-uri 設定（LINE は userId など）に依存せず安定する。
     */
    private static final String NAME_ATTRIBUTE_KEY = IdTokenClaimNames.SUB;

    /**
     * SecurityContext に詰める権限。Spring Security のロール解決は
     * {@code OAuth2LoginSuccessHandler} → {@code PhotlasOAuth2User#getAuthorities()}
     * 側で {@link User#getRole()} から再構築するため、ここでは固定の {@code ROLE_USER}
     * を入れておけば十分。
     */
    private static final List<GrantedAuthority> DEFAULT_AUTHORITIES =
            Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"));

    private final OAuth2UserServiceHelper helper;

    public CustomOidcUserService(OAuth2UserServiceHelper helper) {
        this.helper = helper;
    }

    @Override
    public OidcUser loadUser(OidcUserRequest userRequest) throws OAuth2AuthenticationException {
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

        OidcIdToken idToken = userRequest.getIdToken();
        String providerUserId = extractRequired(idToken.getSubject(),
                "OAUTH_PROVIDER_USER_ID_REQUIRED",
                "OAuth プロバイダから sub を取得できませんでした");
        String email = extractRequired(idToken.getEmail(),
                "OAUTH_EMAIL_REQUIRED",
                "OAuth プロバイダから email を取得できませんでした");

        OAuth2AccessToken accessToken = userRequest.getAccessToken();
        String tokenValue = accessToken != null ? accessToken.getTokenValue() : null;
        LocalDateTime tokenExpiresAt = toLocalDateTimeUtc(
                accessToken != null ? accessToken.getExpiresAt() : null);

        String language = readLanguageFromSession();

        OAuth2UserInfo info = new OAuth2UserInfo(
                provider,
                providerUserId,
                email,
                tokenValue,
                tokenExpiresAt,
                language
        );

        User user = helper.processOAuthUser(info);

        // user-info 呼び出しはスキップし、ID トークンクレームのみで OidcUser を構築する。
        OidcUser delegateOidcUser = new DefaultOidcUser(
                Set.copyOf(DEFAULT_AUTHORITIES),
                idToken,
                NAME_ATTRIBUTE_KEY
        );
        return new PhotlasOidcUser(user, delegateOidcUser);
    }

    private static String extractRequired(String value, String errorCode, String description) {
        if (value == null || value.isBlank()) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error(errorCode, description, null),
                    errorCode
            );
        }
        return value;
    }

    private static String readLanguageFromSession() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        if (!(attrs instanceof ServletRequestAttributes servletAttrs)) {
            return null;
        }
        HttpSession session = servletAttrs.getRequest().getSession(false);
        if (session == null) {
            return null;
        }
        Object lang = session.getAttribute(CustomOAuth2UserService.SESSION_ATTRIBUTE_LANG);
        return lang != null ? Objects.toString(lang, null) : null;
    }

    private static LocalDateTime toLocalDateTimeUtc(Instant instant) {
        return instant == null ? null : LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
