package com.photlas.backend.config;

import com.photlas.backend.filter.RateLimitFilter;
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
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.util.matcher.RegexRequestMatcher;

/**
 * Spring Security設定
 * Issue#22: API Rate Limiting - レート制限フィルター追加
 * Issue#23: Production Security Hardening - CSRF保護、環境変数化
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

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

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, RateLimitFilter rateLimitFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.rateLimitFilter = rateLimitFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // Issue#23: CSRF保護を有効化（Cookie-based token repository使用）
            .csrf(csrf -> csrf
                .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                .ignoringRequestMatchers(AUTH_ENDPOINT_PATTERN) // 認証エンドポイントはCSRF除外
            )
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
                .requestMatchers(HttpMethod.GET, PHOTOS_ENDPOINT_PATTERN).permitAll()  // 写真閲覧
                .requestMatchers(new RegexRequestMatcher(USER_PROFILE_PATTERN, HttpMethod.GET.name())).permitAll()  // ユーザープロフィール閲覧
                .requestMatchers(new RegexRequestMatcher(USER_PHOTOS_PATTERN, HttpMethod.GET.name())).permitAll()   // ユーザー写真一覧閲覧
                .anyRequest().authenticated()  // その他は認証必須
            )
            // 認証エラーハンドリング
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint((request, response, authException) -> {
                    response.sendError(
                        HttpStatus.UNAUTHORIZED.value(),
                        HttpStatus.UNAUTHORIZED.getReasonPhrase()
                    );
                })
            )
            // Issue#22: レート制限フィルターを追加
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            // JWT認証フィルターを追加
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}