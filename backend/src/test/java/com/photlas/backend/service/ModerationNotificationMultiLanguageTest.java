package com.photlas.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.invocation.InvocationOnMock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/**
 * Issue#113 フェーズ 4 - ModerationNotificationService の 5 言語化テスト。
 *
 * <p>4 種類の通知（隔離 / 警告 / 一時停止 / 永久停止）が言語に応じて適切な
 * 言語で送信されることを検証する。グループ B (@Async + try-catch + ERROR ログ) も対象。</p>
 *
 * <p>本テストは Mockito ベース（@SpringBootTest を使わない）。理由:
 * <ul>
 *   <li>@SpringBootTest だと @Async が実際に非同期実行され、テストアサーションが
 *       タイミング依存になる</li>
 *   <li>EmailTemplateService は実 ReloadableResourceBundleMessageSource を組み立てて
 *       注入することで、実際の properties ファイルを読みつつ同期で動作させる</li>
 * </ul>
 * これにより「実際の翻訳 properties が読み込まれる + 同期実行で検証可能」を両立する。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ModerationNotificationMultiLanguageTest {

    @Mock private JavaMailSender mailSender;

    private EmailTemplateService emailTemplateService;
    private ModerationNotificationService notificationService;

    @BeforeEach
    void setUp() {
        // 実 MessageSource を組み立てる（properties ファイル経由）
        ReloadableResourceBundleMessageSource source = new ReloadableResourceBundleMessageSource();
        source.setBasename("classpath:i18n/email/messages");
        source.setDefaultEncoding("UTF-8");
        source.setDefaultLocale(Locale.ENGLISH);
        source.setFallbackToSystemLocale(false);
        emailTemplateService = new EmailTemplateService(source);
        notificationService = new ModerationNotificationService(mailSender, emailTemplateService);
        ReflectionTestUtils.setField(notificationService, "mailFrom", "noreply@photlas.jp");
    }

    @Test
    @DisplayName("Issue#113 - 隔離通知 ja: 日本語の件名・本文")
    void quarantineJa() {
        notificationService.sendQuarantineNotification("ja@example.com", "naegi",
                LocalDateTime.of(2026, 3, 15, 14, 30), "ja");

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
    @DisplayName("Issue#113 - グループ B: メール送信失敗でも例外が外に伝播しない")
    void groupBFailureSwallowed() {
        doThrow(new RuntimeException("SMTP failure")).when(mailSender).send(any(SimpleMailMessage.class));

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
