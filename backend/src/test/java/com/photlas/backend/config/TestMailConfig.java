package com.photlas.backend.config;

import org.mockito.Mockito;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * テスト環境用のJavaMailSenderモック設定
 * メール送信をモック化し、テスト中に実際のSMTPサーバーへの接続を行わない。
 */
@Configuration
@Profile("test")
public class TestMailConfig {

    @Bean
    @Primary
    public JavaMailSender javaMailSender() {
        return Mockito.mock(JavaMailSender.class);
    }
}
