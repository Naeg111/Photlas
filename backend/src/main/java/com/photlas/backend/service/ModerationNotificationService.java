package com.photlas.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Issue#54: モデレーション関連のメール通知サービス
 * 隔離・警告・停止・永久停止時にユーザーへメール通知を送信する
 *
 * <p>Issue#113: テンプレートを {@link EmailTemplateService} 経由 (5 言語対応) に
 * 移行。{@code MAIL_SIGNATURE_JA} / {@code MAIL_SIGNATURE_EN} 定数は properties
 * ファイルの {@code email.signature} に統合済み。</p>
 *
 * <p>本サービスのメールはすべてグループ B (§4.5):
 * <ul>
 *   <li>{@code @Async} のまま維持（管理者操作・Lambda コールバックを止めない）</li>
 *   <li>失敗時は {@code [ALERT]} 接頭辞付きの ERROR ログを出力（CloudWatch メトリックフィルタ対象）</li>
 *   <li>業務処理（モデレーション処分）は完了扱い（DB の処分はロールバックしない）</li>
 * </ul>
 */
@Service
public class ModerationNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(ModerationNotificationService.class);
    private static final String DEFAULT_LANGUAGE = "ja";

    private final JavaMailSender mailSender;
    private final EmailTemplateService emailTemplateService;

    @Value("${app.mail.from:Photlas <noreply@photlas.jp>}")
    private String mailFrom;

    public ModerationNotificationService(JavaMailSender mailSender,
                                         EmailTemplateService emailTemplateService) {
        this.mailSender = mailSender;
        this.emailTemplateService = emailTemplateService;
    }

    /**
     * 写真が隔離された場合の通知
     */
    @Async
    public void sendQuarantineNotification(String email, String username,
                                            LocalDateTime createdAt, String language) {
        String dateStr = formatCreatedAt(createdAt, language);
        String subject = emailTemplateService.subject("email.moderationQuarantine", language);
        String body = emailTemplateService.body("email.moderationQuarantine", language, username, dateStr);
        sendEmail(email, subject, body, "moderationQuarantine");
    }

    /**
     * 後方互換性のためのオーバーロード
     */
    @Async
    public void sendQuarantineNotification(String email, String username, LocalDateTime createdAt) {
        sendQuarantineNotification(email, username, createdAt, DEFAULT_LANGUAGE);
    }

    /**
     * 警告通知（1回目の違反）
     */
    @Async
    public void sendWarningNotification(String email, String username, String reason, String language) {
        String subject = emailTemplateService.subject("email.moderationWarning", language);
        String body = emailTemplateService.body("email.moderationWarning", language, username, reason);
        sendEmail(email, subject, body, "moderationWarning");
    }

    /**
     * 後方互換性のためのオーバーロード
     */
    @Async
    public void sendWarningNotification(String email, String username, String reason) {
        sendWarningNotification(email, username, reason, DEFAULT_LANGUAGE);
    }

    /**
     * 一時停止通知（2回目の違反）
     */
    @Async
    public void sendTemporarySuspensionNotification(
            String email, String username, String reason, LocalDate suspendedUntil, String language) {
        String subject = emailTemplateService.subject("email.moderationSuspension", language);
        String body = emailTemplateService.body("email.moderationSuspension", language,
                username, reason, suspendedUntil.toString());
        sendEmail(email, subject, body, "moderationSuspension");
    }

    /**
     * 後方互換性のためのオーバーロード
     */
    @Async
    public void sendTemporarySuspensionNotification(
            String email, String username, String reason, LocalDate suspendedUntil) {
        sendTemporarySuspensionNotification(email, username, reason, suspendedUntil, DEFAULT_LANGUAGE);
    }

    /**
     * 永久停止通知（3回目以降の違反）
     */
    @Async
    public void sendPermanentSuspensionNotification(String email, String username, String reason, String language) {
        String subject = emailTemplateService.subject("email.moderationPermanentBan", language);
        String body = emailTemplateService.body("email.moderationPermanentBan", language, username, reason);
        sendEmail(email, subject, body, "moderationPermanentBan");
    }

    /**
     * 後方互換性のためのオーバーロード
     */
    @Async
    public void sendPermanentSuspensionNotification(String email, String username, String reason) {
        sendPermanentSuspensionNotification(email, username, reason, DEFAULT_LANGUAGE);
    }

    /**
     * createdAt を言語に応じて整形する。
     */
    private String formatCreatedAt(LocalDateTime createdAt, String language) {
        if (createdAt == null) return "";
        if ("en".equals(language)) {
            return createdAt.format(DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm", Locale.ENGLISH));
        }
        if ("ja".equals(language)) {
            return createdAt.format(DateTimeFormatter.ofPattern("yyyy年MM月dd日 HH:mm"));
        }
        // ko / zh-CN / zh-TW は ISO に近い表記で統一
        return createdAt.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"));
    }

    /**
     * メールを送信する（グループ B: 失敗時 [ALERT] ERROR ログのみ、@Async のまま維持）
     */
    private void sendEmail(String to, String subject, String body, String emailType) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            logger.info("モデレーション通知メール送信完了: type={} to={}", emailType, to);
        } catch (Exception e) {
            // Issue#113 §4.5 B-1: [ALERT] 接頭辞 + 構造化フィールドで監視可能にする。
            // PII 配慮: email アドレス本体はログに残さず emailType のみ記録。
            logger.error("[ALERT] {} email send failed: error={}", emailType, e.getMessage(), e);
        }
    }
}
