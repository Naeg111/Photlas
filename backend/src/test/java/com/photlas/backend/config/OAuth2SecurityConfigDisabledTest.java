package com.photlas.backend.config;

import com.photlas.backend.security.CustomOAuth2AuthorizationRequestResolver;
import com.photlas.backend.security.CustomOAuth2UserService;
import com.photlas.backend.security.OAuth2LoginFailureHandler;
import com.photlas.backend.security.OAuth2LoginSuccessHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#81 Phase 3f - {@code photlas.oauth.enabled=false}（未設定を含む）時の Spring Security 設定検証。
 *
 * <p>{@link OAuth2SecurityConfig} は {@code @ConditionalOnProperty("photlas.oauth.enabled"="true")}
 * で条件付き生成されるため、無効時は:
 * <ul>
 *   <li>{@code OAuth2SecurityConfig} Bean そのものが生成されない</li>
 *   <li>その中で定義される {@link CustomOAuth2UserService} / {@link CustomOAuth2AuthorizationRequestResolver} /
 *       {@link OAuth2LoginSuccessHandler} / {@link OAuth2LoginFailureHandler} も生成されない</li>
 *   <li>{@link SecurityFilterChain} は既存 {@code SecurityConfig} の 1 件のみ</li>
 * </ul>
 *
 * <p>これにより、ローカル開発 / CI の test プロファイルで OAuth クライアント設定
 * （client-id 等）が無くてもアプリが起動できることを担保する。
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("Issue#81 Phase 3f - OAuth 無効時の Spring Security 設定")
class OAuth2SecurityConfigDisabledTest {

    @Autowired
    private ApplicationContext ctx;

    @Test
    @DisplayName("OAuth 無効時は OAuth2SecurityConfig Bean が存在しない")
    void oauthDisabled_configBeanNotLoaded() {
        // Spring の Bean 名生成規則: 先頭 2 文字が連続で大文字の場合は decapitalize されないため
        // "OAuth2SecurityConfig" はそのままの名前で登録される（無効時は不在）
        assertThat(ctx.containsBean("OAuth2SecurityConfig")).isFalse();
    }

    @Test
    @DisplayName("OAuth 無効時は CustomOAuth2UserService Bean が登録されない")
    void oauthDisabled_customOAuth2UserServiceNotRegistered() {
        assertThat(ctx.getBeanNamesForType(CustomOAuth2UserService.class)).isEmpty();
    }

    @Test
    @DisplayName("OAuth 無効時は CustomOAuth2AuthorizationRequestResolver Bean が登録されない")
    void oauthDisabled_customOAuth2AuthorizationRequestResolverNotRegistered() {
        assertThat(ctx.getBeanNamesForType(CustomOAuth2AuthorizationRequestResolver.class)).isEmpty();
    }

    @Test
    @DisplayName("OAuth 無効時は OAuth2LoginSuccessHandler Bean が登録されない")
    void oauthDisabled_oAuth2LoginSuccessHandlerNotRegistered() {
        assertThat(ctx.getBeanNamesForType(OAuth2LoginSuccessHandler.class)).isEmpty();
    }

    @Test
    @DisplayName("OAuth 無効時は OAuth2LoginFailureHandler Bean が登録されない")
    void oauthDisabled_oAuth2LoginFailureHandlerNotRegistered() {
        assertThat(ctx.getBeanNamesForType(OAuth2LoginFailureHandler.class)).isEmpty();
    }

    @Test
    @DisplayName("OAuth 無効時は SecurityFilterChain は既存 SecurityConfig の 1 件のみ")
    void oauthDisabled_onlyOneSecurityFilterChain() {
        String[] names = ctx.getBeanNamesForType(SecurityFilterChain.class);
        assertThat(names).hasSize(1);
    }
}
