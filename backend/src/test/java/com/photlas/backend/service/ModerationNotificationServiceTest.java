package com.photlas.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Issue#54: モデレーション通知メールサービスのテスト
 */
@ExtendWith(MockitoExtension.class)
public class ModerationNotificationServiceTest {

    @Mock
    private JavaMailSender mailSender;

    @InjectMocks
    private ModerationNotificationService notificationService;

    @Test
    @DisplayName("Issue#54 - 隔離通知メールが正しい件名・本文で送信される")
    void testSendQuarantineNotification() {
        LocalDateTime createdAt = LocalDateTime.of(2026, 3, 15, 14, 30);
        notificationService.sendQuarantineNotification(
                "user@example.com", "テストユーザー", createdAt);

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender, times(1)).send(captor.capture());

        SimpleMailMessage message = captor.getValue();
        assertThat(message.getTo()).containsExactly("user@example.com");
        assertThat(message.getSubject()).contains("審査");
        assertThat(message.getText()).contains("テストユーザー");
        assertThat(message.getText()).contains("2026年03月15日 14:30");
    }

    @Test
    @DisplayName("Issue#54 - 警告通知メールが違反理由を含む")
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
    @DisplayName("Issue#54 - 一時停止通知メールが停止期間を含む")
    void testSendTemporarySuspensionNotification() {
        LocalDate suspendedUntil = LocalDate.of(2026, 5, 10);

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
    @DisplayName("Issue#54 - 永久停止通知メールが送信される")
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

    @Test
    @DisplayName("Issue#54 - メール送信失敗時に例外がスローされない")
    void testSendEmail_Failure_DoesNotThrow() {
        doThrow(new RuntimeException("SMTP接続エラー"))
                .when(mailSender).send(any(SimpleMailMessage.class));

        // 例外がスローされないことを確認
        notificationService.sendQuarantineNotification(
                "user@example.com", "テストユーザー", LocalDateTime.of(2026, 3, 15, 14, 30));
    }
}
