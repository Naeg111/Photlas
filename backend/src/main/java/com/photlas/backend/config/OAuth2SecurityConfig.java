package com.photlas.backend.config;

import com.photlas.backend.security.CustomOAuth2AuthorizationRequestResolver;
import com.photlas.backend.security.CustomOAuth2UserService;
import com.photlas.backend.security.CustomOidcUserService;
import com.photlas.backend.security.OAuth2LoginFailureHandler;
import com.photlas.backend.security.OAuth2LoginSuccessHandler;
import com.photlas.backend.service.JwtService;
import com.photlas.backend.service.OAuth2UserServiceHelper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.client.oidc.authentication.OidcIdTokenDecoderFactory;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.jose.jws.JwsAlgorithm;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoderFactory;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Issue#81 Phase 3f - OAuth2 ログインに特化した Spring Security 設定。
 *
 * <p>{@code photlas.oauth.enabled=true} のときだけ有効化される。デフォルトは無効で、
 * 既存の {@link SecurityConfig} のフィルタチェインがそのまま全パスを処理する。
 * 有効化時は {@link Order @Order(1)} で優先されるため、
 * {@code /api/v1/auth/oauth2/**} のパスをこちらのフィルタチェインで捌く。
 *
 * <p>パス設計（技術設計書 §3.13）:
 * <ul>
 *   <li>認可開始: {@code GET /api/v1/auth/oauth2/authorization/{provider}}（Spring デフォルトの
 *       {@code /oauth2/authorization/*} ではなくカスタム base URI）</li>
 *   <li>コールバック: {@code GET /api/v1/auth/oauth2/callback/{provider}}（同上、
 *       デフォルトの {@code /login/oauth2/code/*} から変更）</li>
 * </ul>
 *
 * <p>構成する Bean:
 * <ul>
 *   <li>{@link CustomOAuth2UserService} - プロバイダから取得した属性を正規化して
 *       {@link OAuth2UserServiceHelper} に委譲する</li>
 *   <li>{@link CustomOAuth2AuthorizationRequestResolver} - 認可リクエスト開始時に
 *       {@code lang} クエリパラメータを HttpSession に保存する。内部の
 *       {@link DefaultOAuth2AuthorizationRequestResolver} にも
 *       {@code /api/v1/auth/oauth2/authorization} を渡して URL を正しくパースさせる</li>
 *   <li>{@link OAuth2LoginSuccessHandler} - JWT を発行し
 *       {@code <frontendUrl>/oauth/callback#access_token=<jwt>} にリダイレクト</li>
 *   <li>{@link OAuth2LoginFailureHandler} - エラーコードを
 *       {@code <frontendUrl>/oauth/callback#error=<code>} フラグメントに詰めてリダイレクト</li>
 * </ul>
 *
 * <p>セッション戦略: {@link SessionCreationPolicy#IF_REQUIRED}。OAuth の state パラメータ管理と
 * {@code CustomOAuth2AuthorizationRequestResolver} での lang 保存のためセッションが必要。
 * 既存 {@link SecurityConfig} は {@link SessionCreationPolicy#STATELESS} のまま維持する
 * （OAuth 関連パス以外は JWT stateless で動かす）。
 *
 * <p>注意:
 * <ul>
 *   <li>{@code photlas.oauth.enabled=true} 時は Spring Security OAuth2 Client の自動設定により、
 *       {@code spring.security.oauth2.client.registration.*} の必須プロパティが
 *       未設定だと起動失敗する</li>
 *   <li>既存 {@link SecurityConfig} の {@code /api/v1/auth/**} permitAll と重複するが、
 *       {@code @Order(1)} により本フィルタチェインが先に評価されるため影響しない</li>
 * </ul>
 */
@Configuration
@ConditionalOnProperty(name = "photlas.oauth.enabled", havingValue = "true")
public class OAuth2SecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(OAuth2SecurityConfig.class);

    /** 認可エンドポイントのカスタム base URI（Spring デフォルト /oauth2/authorization を上書き）。 */
    static final String AUTHORIZATION_BASE_URI = "/api/v1/auth/oauth2/authorization";

    /** コールバック（リダイレクション）エンドポイントのカスタム base URI。 */
    static final String CALLBACK_BASE_URI = "/api/v1/auth/oauth2/callback/*";

    /** OAuth フィルタチェインがマッチするパス範囲。 */
    private static final String SECURITY_MATCHER = "/api/v1/auth/oauth2/**";

    private final OAuth2UserServiceHelper oAuth2UserServiceHelper;
    private final JwtService jwtService;
    private final String frontendUrl;

    public OAuth2SecurityConfig(
            OAuth2UserServiceHelper oAuth2UserServiceHelper,
            JwtService jwtService,
            @Value("${app.frontend-url:https://photlas.jp}") String frontendUrl) {
        this.oAuth2UserServiceHelper = oAuth2UserServiceHelper;
        this.jwtService = jwtService;
        this.frontendUrl = frontendUrl;
    }

    // ---------- OAuth2 サービス・リゾルバ・ハンドラ Bean ----------

    @Bean
    public CustomOAuth2UserService customOAuth2UserService() {
        return new CustomOAuth2UserService(new DefaultOAuth2UserService(), oAuth2UserServiceHelper);
    }

    @Bean
    public CustomOidcUserService customOidcUserService() {
        return new CustomOidcUserService(oAuth2UserServiceHelper);
    }

    /**
     * Issue#99 - OIDC ID トークン署名検証用のデコーダファクトリ。
     *
     * <p>Spring Security のデフォルトは ID トークンを RS256（RSA + SHA-256）で署名されている前提で
     * 検証する。プロバイダごとに署名方式が異なるため、resolver で切り替える:
     *
     * <ul>
     *   <li>LINE: <strong>HS256</strong>（HMAC + SHA-256、共通鍵 = チャネルシークレット）。
     *       LINE Login v2.1 のデフォルト。Spring は MacAlgorithm を返すと
     *       自動で {@code clientRegistration.getClientSecret()} を HMAC 鍵として使う。</li>
     *   <li>その他: デフォルトの RS256（将来 OIDC 化する Apple Sign In 等を想定）。</li>
     * </ul>
     */
    @Bean
    public JwtDecoderFactory<ClientRegistration> idTokenDecoderFactory() {
        log.info("Issue#99: Creating custom idTokenDecoderFactory bean (HS256 for LINE)");
        OidcIdTokenDecoderFactory factory = new OidcIdTokenDecoderFactory();
        factory.setJwsAlgorithmResolver(clientRegistration -> {
            String regId = clientRegistration.getRegistrationId();
            JwsAlgorithm alg = "line".equals(regId)
                    ? MacAlgorithm.HS256
                    : SignatureAlgorithm.RS256;
            log.info("Issue#99: jwsAlgorithmResolver registrationId={} alg={}", regId, alg);
            return alg;
        });
        return factory;
    }

    @Bean
    public CustomOAuth2AuthorizationRequestResolver customOAuth2AuthorizationRequestResolver(
            ClientRegistrationRepository clientRegistrationRepository) {
        DefaultOAuth2AuthorizationRequestResolver defaultResolver =
                new DefaultOAuth2AuthorizationRequestResolver(
                        clientRegistrationRepository,
                        AUTHORIZATION_BASE_URI
                );
        return new CustomOAuth2AuthorizationRequestResolver(defaultResolver);
    }

    @Bean
    public OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler() {
        return new OAuth2LoginSuccessHandler(jwtService, frontendUrl);
    }

    @Bean
    public OAuth2LoginFailureHandler oAuth2LoginFailureHandler() {
        return new OAuth2LoginFailureHandler(frontendUrl);
    }

    // ---------- SecurityFilterChain ----------

    /**
     * OAuth2 ログイン関連パスだけを扱うフィルタチェイン。
     * 既存の {@link SecurityConfig} フィルタチェインより前に評価される（{@code @Order(1)}）。
     */
    @Bean
    @Order(1)
    public SecurityFilterChain oauth2SecurityFilterChain(
            HttpSecurity http,
            CustomOAuth2UserService customOAuth2UserService,
            CustomOidcUserService customOidcUserService,
            CustomOAuth2AuthorizationRequestResolver resolver,
            OAuth2LoginSuccessHandler successHandler,
            OAuth2LoginFailureHandler failureHandler
    ) throws Exception {
        http
                .securityMatcher(SECURITY_MATCHER)
                // Issue#99: CORS 設定（既存 SecurityConfig で定義された corsConfigurationSource Bean を使う）。
                // これがないと /api/v1/auth/oauth2/confirm-link への POST がブラウザの CORS preflight 段階で
                // 失敗して送信されない。
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .oauth2Login(oauth -> oauth
                        .authorizationEndpoint(endpoint -> endpoint
                                .baseUri(AUTHORIZATION_BASE_URI)
                                .authorizationRequestResolver(resolver))
                        .redirectionEndpoint(endpoint -> endpoint
                                .baseUri(CALLBACK_BASE_URI))
                        .userInfoEndpoint(userInfo -> userInfo
                                .userService(customOAuth2UserService)
                                .oidcUserService(customOidcUserService))
                        .successHandler(successHandler)
                        .failureHandler(failureHandler)
                );
        return http.build();
    }
}
