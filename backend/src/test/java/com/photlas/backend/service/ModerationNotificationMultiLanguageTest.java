package com.photlas.backend.service;

import com.photlas.backend.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalDate;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/**
 * Issue#113 フェーズ 4 - ModerationNotificationService の 5 言語化テスト。
 *
 * <p>4 種類の通知（隔離 / 警告 / 一時停止 / 永久停止）が User の言語に
 * 応じて適切な言語で送信されることを検証する。グループ B (@Async 維持・
 * 失敗時 ERROR ログ統一) の挙動も対象。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
class ModerationNotificationMultiLanguageTest {

    @Autowired private ModerationNotificationService notificationService;

    @MockBean private JavaMailSender mailSender;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.reset(mailSender);
    }

    @Test
    @DisplayName("Issue#113 - 隔離通知 ja: 日本語の件名・本文")
    void quarantineJa() {
        notificationService.sendQuarantineNotification("ja@example.com", "naegi",
                LocalDateTime.now(), "ja");

        SimpleMailMessage captured = captureSent();
        assertThat(captured.getSubject()).contains("Photlas").contains("審査");
        assertThat(captured.getText()).contains("コンテンツポリシー");
    }

    @Test
    @DisplayName("Issue#113 - 隔離通知 en: 英語の件名")
    void quarantineEn() {
        notificationService.sendQuarantineNotification("en@example.com", "naegi",
                LocalDateTime.now(), "en");

        SimpleMailMessage captured = captureSent();
        assertThat(captured.getSubject()).contains("Photlas").contains("Review");
    }

    @Test
    @DisplayName("Issue#113 - 隔離通知 ko: ハングル件名")
    void quarantineKo() {
        notificationService.sendQuarantineNotification("ko@example.com", "naegi",
                LocalDateTime.now(), "ko");

        SimpleMailMessage captured = captureSent();
        assertThat(captured.getSubject()).matches(".*[\\uAC00-\\uD7AF].*");
    }

    @Test
    @DisplayName("Issue#113 - 隔離通知 zh-CN: 簡体中文件名")
    void quarantineZhCn() {
        notificationService.sendQuarantineNotification("zhcn@example.com", "naegi",
                LocalDateTime.now(), "zh-CN");

        SimpleMailMessage captured = captureSent();
        assertThat(captured.getSubject()).matches(".*[\\u4E00-\\u9FFF].*");
    }

    @Test
    @DisplayName("Issue#113 - 警告通知 ja: 違反理由が本文に含まれる")
    void warningJaIncludesReason() {
        notificationService.sendWarningNotification("ja@example.com", "naegi",
                "不適切な投稿", "ja");

        SimpleMailMessage captured = captureSent();
        assertThat(captured.getText()).contains("不適切な投稿");
        assertThat(captured.getSubject()).contains("Photlas").contains("警告");
    }

    @Test
    @DisplayName("Issue#113 - 警告通知 en: 違反理由が本文に含まれる")
    void warningEnIncludesReason() {
        notificationService.sendWarningNotification("en@example.com", "naegi",
                "Inappropriate content", "en");

        SimpleMailMessage captured = captureSent();
        assertThat(captured.getText()).contains("Inappropriate content");
        assertThat(captured.getSubject()).contains("Photlas").contains("Warning");
    }

    @Test
    @DisplayName("Issue#113 - 一時停止通知 ja: 停止期間が本文に含まれる")
    void suspensionJaIncludesPeriod() {
        LocalDate suspendedUntil = LocalDate.of(2026, 6, 30);
        notificationService.sendTemporarySuspensionNotification("ja@example.com", "naegi",
                "違反", suspendedUntil, "ja");

        SimpleMailMessage captured = captureSent();
        assertThat(captured.getText()).contains("2026-06-30");
        assertThat(captured.getSubject()).contains("Photlas");
    }

    @Test
    @DisplayName("Issue#113 - 永久停止通知 ja: 適切な日本語文言")
    void permanentBanJa() {
        notificationService.sendPermanentSuspensionNotification("ja@example.com", "naegi",
                "重大違反", "ja");

        SimpleMailMessage captured = captureSent();
        assertThat(captured.getSubject()).contains("Photlas").contains("永久停止");
        assertThat(captured.getText()).contains("重大違反");
    }

    @Test
    @DisplayName("Issue#113 - 永久停止通知 en: 適切な英語文言")
    void permanentBanEn() {
        notificationService.sendPermanentSuspensionNotification("en@example.com", "naegi",
                "Severe violation", "en");

        SimpleMailMessage captured = captureSent();
        assertThat(captured.getSubject()).contains("Photlas").contains("Permanent");
    }

    @Test
    @DisplayName("Issue#113 - グループ B: メール送信失敗でも例外が外に伝播しない（@Async + try-catch）")
    void groupBFailureSwallowed() {
        doThrow(new RuntimeException("SMTP failure")).when(mailSender).send(any(SimpleMailMessage.class));

        // @Async は呼び出し元に例外を返さない契約のため、テスト内では同期実行になる
        // が、try-catch でラップされているので例外は伝播しない
        notificationService.sendQuarantineNotification("err@example.com", "naegi",
                LocalDateTime.now(), "ja");
        // 例外が伝播しなければテスト成功
    }

    private SimpleMailMessage captureSent() {
        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());
        return captor.getValue();
    }
}
