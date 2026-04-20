package com.photlas.backend.config;

import com.photlas.backend.util.OAuthTokenEncryptor;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#81 Hotfix - {@link OAuthConfig} の条件付きロードを検証する。
 *
 * <p>背景: Phase 3f の設計では {@code OAuthConfig} は無条件ロードで {@link OAuthTokenEncryptor}
 * を生成していたが、{@code photlas.oauth.enabled=false} 時でも
 * {@code photlas.oauth.encryption-key-base64} が空だと Bean 生成が失敗し Spring context
 * 起動失敗 → staging/prod で全 API ダウンに繋がっていた。
 *
 * <p>本テストは {@code photlas.oauth.enabled=false}（test プロファイルのデフォルト）時に
 * {@link OAuthTokenEncryptor} Bean が生成されない（= {@code @ConditionalOnProperty} が効いている）
 * ことを検証する。
 *
 * <p>有効時の検証は既存の {@code OAuth2SecurityConfigEnabledTest} が
 * {@code CustomOAuth2UserService} などを通じて間接的にカバーしている。
 */
@SpringBootTest
@ActiveProfiles("test")
@DisplayName("Issue#81 Hotfix - OAuthConfig の条件付きロード")
class OAuthConfigConditionalTest {

    @Autowired
    private ApplicationContext ctx;

    @Test
    @DisplayName("photlas.oauth.enabled=false のとき OAuthTokenEncryptor Bean は生成されない")
    void oauthDisabled_encryptorBeanNotRegistered() {
        String[] beanNames = ctx.getBeanNamesForType(OAuthTokenEncryptor.class);
        assertThat(beanNames)
                .as("OAuth 無効時は OAuthTokenEncryptor が Bean として登録されず、"
                        + "encryption-key-base64 が空でも起動に影響しないこと")
                .isEmpty();
    }

    @Test
    @DisplayName("photlas.oauth.enabled=false のとき OAuthConfig 自体も context に存在しない")
    void oauthDisabled_configBeanNotRegistered() {
        // クラス名 "OAuthConfig" は Spring の Introspector.decapitalize で先頭 2 文字
        // 連続大文字のためそのまま残る
        assertThat(ctx.containsBean("OAuthConfig")).isFalse();
    }
}
