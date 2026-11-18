package com.photlas.backend.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.TimeZone;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Spec#54: モデレーション通知メールサービスのテスト
 *
 * <p>Spec#113 でテンプレートが {@link EmailTemplateService} 経由になったため、
 * Mockito の varargs 仕様（空 varargs マッチが信頼できない）を回避するため
 * 実 {@link ReloadableResourceBundleMessageSource} を組み立てて使用する。</p>
 */
@ExtendWith(MockitoExtension.class)
public class ModerationNotificationServiceTest {

    @Mock
    private JavaMailSender mailSender;

    private EmailTemplateService emailTemplateService;
    private ModerationNotificationService notificationService;
    private TimeZone originalDefault;

    @BeforeEach
    void setUp() {
        // Spec#169: 本番と同じく JVM を UTC にする（保存されている時刻は UTC の時刻）
        originalDefault = TimeZone.getDefault();
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

        // 実 MessageSource を組み立てて properties ファイルから件名・本文を読み込む
        ReloadableResourceBundleMessageSource source = new ReloadableResourceBundleMessageSource();
        source.setBasename("classpath:i18n/email/messages");
        source.setDefaultEncoding("UTF-8");
        source.setDefaultLocale(Locale.ENGLISH);
        source.setFallbackToSystemLocale(false);
        emailTemplateService = new EmailTemplateService(source);
        notificationService = new ModerationNotificationService(mailSender, emailTemplateService);
        ReflectionTestUtils.setField(notificationService, "mailFrom", "noreply@photlas.jp");
    }

    @AfterEach
    void restoreDefaultTimeZone() {
        TimeZone.setDefault(originalDefault);
    }

    @Test
    @DisplayName("Spec#54 / Spec#169 - 隔離通知メールが正しい件名・本文で送信され、投稿日時は日本時間（JST）で書かれる")
    void testSendQuarantineNotification() {
        // 保存されている時刻は UTC（05:30 UTC = 14:30 JST）
        LocalDateTime createdAt = LocalDateTime.of(2026, 3, 15, 5, 30);
        notificationService.sendQuarantineNotification(
                "user@example.com", "テストユーザー", createdAt);

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        SimpleMailMessage message = captor.getValue();
        assertThat(message.getTo()).containsExactly("user@example.com");
        assertThat(message.getSubject()).contains("審査");
        assertThat(message.getText()).contains("テストユーザー");
        assertThat(message.getText()).contains("2026年03月15日 14:30 JST");
    }

    @Test
    @DisplayName("Spec#54 - 警告通知メールが違反理由を含む")
    void testSendWarningNotification() {
        notificationService.sendWarningNotification(
                "user@example.com", "テストユーザー", "不適切なコンテンツ");

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        SimpleMailMessage message = captor.getValue();
        assertThat(message.getTo()).containsExactly("user@example.com");
        assertThat(message.getSubject()).contains("警告");
        assertThat(message.getText()).contains("不適切なコンテンツ");
        assertThat(message.getText()).contains("テストユーザー");
    }

    @Test
    @DisplayName("Spec#54 / Spec#169 - 一時停止通知メールが停止期間を含み、終了日は日本時間の日付で書かれる")
    void testSendTemporarySuspensionNotification() {
        // 保存されている時刻は UTC（2026-05-09 20:00 UTC = 2026-05-10 05:00 JST）
        LocalDateTime suspendedUntil = LocalDateTime.of(2026, 5, 9, 20, 0);

        notificationService.sendTemporarySuspensionNotification(
                "user@example.com", "テストユーザー", "暴力的コンテンツ", suspendedUntil);

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        SimpleMailMessage message = captor.getValue();
        assertThat(message.getTo()).containsExactly("user@example.com");
        assertThat(message.getSubject()).contains("一時停止");
        assertThat(message.getText()).contains("暴力的コンテンツ");
        assertThat(message.getText()).contains("2026-05-10");
    }

    @Test
    @DisplayName("Spec#54 - 永久停止通知メールが送信される")
    void testSendPermanentSuspensionNotification() {
        notificationService.sendPermanentSuspensionNotification(
                "user@example.com", "テストユーザー", "著作権侵害");

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        SimpleMailMessage message = captor.getValue();
        assertThat(message.getTo()).containsExactly("user@example.com");
        assertThat(message.getSubject()).contains("永久停止");
        assertThat(message.getText()).contains("著作権侵害");
        assertThat(message.getText()).contains("テストユーザー");
    }

    // ===== Spec#54: Fromアドレス設定テスト =====

    @Test
    @DisplayName("Spec#54 - メールにFromアドレスが設定されている")
    void testSendEmail_HasFromAddress() {
        notificationService.sendQuarantineNotification(
                "user@example.com", "テストユーザー", LocalDateTime.of(2026, 3, 15, 14, 30));

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        SimpleMailMessage message = captor.getValue();
        assertThat(message.getFrom()).isNotNull();
        assertThat(message.getFrom()).contains("noreply@photlas.jp");
    }

    @Test
    @DisplayName("Spec#54 - メール送信失敗時に例外がスローされない")
    void testSendEmail_Failure_DoesNotThrow() {
        doThrow(new RuntimeException("SMTP接続エラー"))
                .when(mailSender).send(any(SimpleMailMessage.class));

        // 例外がスローされないことを確認
        notificationService.sendQuarantineNotification(
                "user@example.com", "テストユーザー", LocalDateTime.of(2026, 3, 15, 14, 30));
    }
}
