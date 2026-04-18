package com.photlas.backend.config;

import com.photlas.backend.filter.RateLimitFilter;
import com.photlas.backend.filter.TraceIdFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.security.web.util.matcher.RegexRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Spring Security設定
 * Issue#22: API Rate Limiting - レート制限フィルター追加
 * Issue#23: Production Security Hardening - CSRF保護、環境変数化
 */
@Configuration
@EnableWebSecurity
@org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
public class SecurityConfig {

    // CORS許可オリジン（環境変数から取得、カンマ区切り）
    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000}")
    private String allowedOriginsConfig;

    // エンドポイントパス定数
    private static final String AUTH_ENDPOINT_PATTERN = "/api/v1/auth/**";
    private static final String HEALTH_ENDPOINT = "/api/v1/health";
    private static final String ERROR_ENDPOINT = "/error";
    private static final String SPOTS_ENDPOINT = "/api/v1/spots";
    private static final String SPOTS_ENDPOINT_PATTERN = "/api/v1/spots/**";
    private static final String CATEGORIES_ENDPOINT = "/api/v1/categories";
    private static final String PHOTOS_ENDPOINT_PATTERN = "/api/v1/photos/**";
    private static final String USER_PROFILE_PATTERN = "/api/v1/users/\\d+";
    private static final String USER_PHOTOS_PATTERN = "/api/v1/users/\\d+/photos.*";

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RateLimitFilter rateLimitFilter;
    private final TraceIdFilter traceIdFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          RateLimitFilter rateLimitFilter,
                          TraceIdFilter traceIdFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.rateLimitFilter = rateLimitFilter;
        this.traceIdFilter = traceIdFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * CORS設定
     * フロントエンドからのクロスオリジンリクエストを許可
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // 許可するオリジンを設定（環境変数から取得）
        List<String> allowedOrigins = Arrays.asList(allowedOriginsConfig.split(","));
        configuration.setAllowedOrigins(allowedOrigins);

        // 許可するHTTPメソッド
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));

        // 許可するヘッダー
        configuration.setAllowedHeaders(Arrays.asList("*"));

        // 認証情報（Cookie、Authorization header等）を許可
        configuration.setAllowCredentials(true);

        // プリフライトリクエストのキャッシュ時間（1時間）
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // CORS設定を有効化
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // Issue#23: CSRF保護の設定
            // JWT認証（stateless）を使用しているためCSRF保護は無効化
            // 理由: JWTはlocalStorageに保存され、リクエストごとに明示的にAuthorizationヘッダーで
            // 送信されるため、ブラウザが自動的にCookieを送信するCSRF攻撃の対象にならない
            .csrf(csrf -> csrf.disable())
            // ステートレスセッション管理（JWT認証使用のため）
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            )
            // 認可設定
            .authorizeHttpRequests(authz -> authz
                .requestMatchers(AUTH_ENDPOINT_PATTERN).permitAll()     // 認証エンドポイント
                .requestMatchers(HEALTH_ENDPOINT).permitAll()            // ヘルスチェック
                .requestMatchers(ERROR_ENDPOINT).permitAll()             // エラーページ
                .requestMatchers(SPOTS_ENDPOINT, SPOTS_ENDPOINT_PATTERN).permitAll()  // スポット関連（一覧・詳細）
                .requestMatchers(CATEGORIES_ENDPOINT).permitAll()        // カテゴリ一覧
                .requestMatchers("/api/v1/ogp/**").permitAll()              // OGPメタタグ
                .requestMatchers("/api/v1/sitemap.xml").permitAll()         // サイトマップインデックス
                .requestMatchers("/api/v1/sitemap-static.xml").permitAll()   // 静的サイトマップ
                .requestMatchers("/api/v1/sitemap-photos-*.xml").permitAll() // 写真サイトマップ
                .requestMatchers("/api/v1/internal/**").permitAll()         // Issue#54: 内部API（APIキー認証）
                .requestMatchers(HttpMethod.GET, PHOTOS_ENDPOINT_PATTERN).permitAll()  // 写真閲覧
                .requestMatchers(new RegexRequestMatcher(USER_PROFILE_PATTERN, HttpMethod.GET.name())).permitAll()  // ユーザープロフィール閲覧
                .requestMatchers(new RegexRequestMatcher(USER_PHOTOS_PATTERN, HttpMethod.GET.name())).permitAll()   // ユーザー写真一覧閲覧
                .anyRequest().authenticated()  // その他は認証必須
            )
            // 認証エラーハンドリング
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint((request, response, authException) ->
                    response.sendError(
                        HttpStatus.UNAUTHORIZED.value(),
                        HttpStatus.UNAUTHORIZED.getReasonPhrase()
                    )
                )
            )
            // セキュリティヘッダー
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny())
                .contentTypeOptions(contentType -> {})
                .httpStrictTransportSecurity(hsts -> hsts
                    .includeSubDomains(true)
                    .maxAgeInSeconds(31536000)
                )
                .referrerPolicy(referrer -> referrer
                    .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN)
                )
            )
            // フィルタ順序（Issue#95）:
            //   TraceIdFilter → JwtAuthenticationFilter → RateLimitFilter → UsernamePasswordAuthenticationFilter
            // 理由:
            //   - TraceIdFilter は最前段で MDC に traceId を格納し、以降のログを相関可能にする
            //   - RateLimitFilter は SecurityContext から認証済みユーザーの email を取得して
            //     user:{email} 単位で独立したバケットを持つため、JWT 検証後に動く必要がある
            // 実装: Spring Security は addFilterBefore() で同じ reference を指定すると
            //   登録順に並ぶ（ArrayList.sort の安定性）ため、下記の順で追加すれば
            //   TraceId → Jwt → RateLimit の順に実行される。
            .addFilterBefore(traceIdFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}