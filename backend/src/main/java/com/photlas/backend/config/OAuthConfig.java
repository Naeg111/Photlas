package com.photlas.backend.config;

import com.photlas.backend.util.OAuthTokenEncryptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Issue#81 - OAuth 関連の Bean 定義。
 *
 * {@link OAuthTokenEncryptor} は AES-256-GCM の鍵を設定プロパティ
 * {@code photlas.oauth.encryption-key-base64} から受け取り、シングルトン Bean として
 * 登録する。鍵は Base64 エンコードされた 32 バイト（256 bit）である必要がある。
 *
 * <p>Hotfix: {@code @ConditionalOnProperty("photlas.oauth.enabled"="true")} で条件付き生成。
 * OAuth 無効時（デフォルト）は Bean を生成しないため、{@code OAUTH_ENCRYPTION_KEY_BASE64}
 * 環境変数が未設定でも Spring context 起動は成功する。OAuth 有効化時のみ鍵を必須とする。
 *
 * <p>環境別の設定:
 * <ul>
 *   <li>本番・ステージング: 環境変数 {@code OAUTH_ENCRYPTION_KEY_BASE64} から注入（OAuth 有効時のみ必須）</li>
 *   <li>ローカル / CI: 安全なデフォルト値を使用（{@code application.properties} / {@code application-test.properties}）</li>
 * </ul>
 */
@Configuration
@ConditionalOnProperty(name = "photlas.oauth.enabled", havingValue = "true")
public class OAuthConfig {

    @Bean
    public OAuthTokenEncryptor oauthTokenEncryptor(
            @Value("${photlas.oauth.encryption-key-base64}") String base64Key) {
        return new OAuthTokenEncryptor(base64Key);
    }
}
