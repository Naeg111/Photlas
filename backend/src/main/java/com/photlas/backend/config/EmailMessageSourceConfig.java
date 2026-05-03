package com.photlas.backend.config;

import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;

import java.util.Locale;

/**
 * Issue#113: メールテンプレート用の MessageSource Bean 定義。
 *
 * <p>Spring Boot のオートコンフィグで作られる標準 MessageSource (`messages.properties` 用) と
 * 分離するため、専用 Bean 名 `emailMessageSource` で定義する。</p>
 *
 * <p>{@code ReloadableResourceBundleMessageSource} を採用する理由は UTF-8 の
 * ネイティブサポート。{@code ResourceBundleMessageSource} のデフォルトエンコーディング
 * (ISO-8859-1) では日本語・韓国語・中国語の文字が文字化けする。</p>
 */
@Configuration
public class EmailMessageSourceConfig {

    @Bean("emailMessageSource")
    public MessageSource emailMessageSource() {
        ReloadableResourceBundleMessageSource source = new ReloadableResourceBundleMessageSource();
        source.setBasename("classpath:i18n/email/messages");
        source.setDefaultEncoding("UTF-8");
        // フォールバック先を en に固定（サーバー OS の Locale 依存を排除）
        source.setDefaultLocale(Locale.ENGLISH);
        source.setFallbackToSystemLocale(false);
        // 本番はコンテナ再ビルドで反映するためキャッシュを永続化
        source.setCacheSeconds(-1);
        return source;
    }
}
