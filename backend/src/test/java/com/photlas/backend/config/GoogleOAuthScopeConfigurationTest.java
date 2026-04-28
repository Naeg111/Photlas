package com.photlas.backend.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#99 Phase 1 - Google OAuth スコープ設定検証。
 *
 * <p>本番公開申請に向けて Google OAuth のスコープを最小権限の {@code email} のみに
 * 限定する（{@code profile} を削除）。実装上 {@code CustomOAuth2UserService} は
 * {@code email} と {@code sub} のみを使用しており、ユーザー名は
 * {@code TemporaryUsernameGenerator} で生成するため {@code profile} スコープは不要。
 *
 * <p>{@code openid} を含めると Spring Security が OIDC フローに切り替わり、
 * {@code OAuth2SecurityConfig} で設定済みの {@code userInfoEndpoint.userService()} が
 * スキップされて {@code CustomOAuth2UserService} が呼ばれなくなる。そのため
 * {@code email} 単独でなければならない。
 */
class GoogleOAuthScopeConfigurationTest {

    private static final String GOOGLE_SCOPE_KEY =
            "spring.security.oauth2.client.registration.google.scope";

    private static final Path STAGING_PROPERTIES =
            Paths.get("src/main/resources/application-staging.properties");

    private static final Path PROD_PROPERTIES =
            Paths.get("src/main/resources/application-prod.properties");

    @Test
    @DisplayName("Issue#99 Phase 1: ステージング環境の Google scope は email のみであること")
    void stagingGoogleScopeIsEmailOnly() throws IOException {
        Properties properties = loadProperties(STAGING_PROPERTIES);

        assertThat(properties.getProperty(GOOGLE_SCOPE_KEY))
                .as("application-staging.properties の %s は email のみ（profile を含まない）", GOOGLE_SCOPE_KEY)
                .isEqualTo("email");
    }

    @Test
    @DisplayName("Issue#99 Phase 1: 本番環境の Google scope は email のみであること")
    void prodGoogleScopeIsEmailOnly() throws IOException {
        Properties properties = loadProperties(PROD_PROPERTIES);

        assertThat(properties.getProperty(GOOGLE_SCOPE_KEY))
                .as("application-prod.properties の %s は email のみ（profile を含まない）", GOOGLE_SCOPE_KEY)
                .isEqualTo("email");
    }

    private static Properties loadProperties(Path path) throws IOException {
        Properties properties = new Properties();
        try (var reader = Files.newBufferedReader(path)) {
            properties.load(reader);
        }
        return properties;
    }
}
