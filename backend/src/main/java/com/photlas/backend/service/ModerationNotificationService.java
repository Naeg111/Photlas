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
 */
@Service
public class ModerationNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(ModerationNotificationService.class);
    private static final String MAIL_SIGNATURE_JA = "\n\nPhotlas\nsupport@photlas.jp";
    private static final String MAIL_SIGNATURE_EN = "\n\nPhotlas Team\nsupport@photlas.jp";

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:Photlas <noreply@photlas.jp>}")
    private String mailFrom;

    public ModerationNotificationService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /**
     * 写真が隔離された場合の通知
     */
    @Async
    public void sendQuarantineNotification(String email, String username, LocalDateTime createdAt, String language) {
        String subject;
        String body;

        if ("en".equals(language)) {
            String dateStr = createdAt.format(DateTimeFormatter.ofPattern("MMM dd, yyyy HH:mm", Locale.ENGLISH));
            subject = "【Photlas】Photo Under Review";
            body = "Hi " + username + ",\n\n"
                    + "Your photo (posted on " + dateStr + ") has been flagged for review under our content policy.\n\n"
                    + "Our team is currently reviewing the content. If no issues are found, the photo will be published automatically.\n\n"
                    + "The review typically takes 1-2 business days.\n"
                    + "If you have any questions, please contact us."
                    + MAIL_SIGNATURE_EN;
        } else {
            String dateStr = createdAt.format(DateTimeFormatter.ofPattern("yyyy年MM月dd日 HH:mm"));
            subject = "【Photlas】投稿の審査について";
            body = username + " さん\n\n"
                    + "投稿された写真（" + dateStr + " 投稿）について、コンテンツポリシーに基づく審査が必要と判断されました。\n\n"
                    + "現在、運営チームによる確認を行っております。審査の結果、問題がないと判断された場合は自動的に公開されます。\n\n"
                    + "審査には通常1〜2営業日程度かかります。\n"
                    + "ご不明な点がございましたら、お問い合わせください。"
                    + MAIL_SIGNATURE_JA;
        }

        sendEmail(email, subject, body);
    }

    /**
     * 後方互換性のためのオーバーロード
     */
    @Async
    public void sendQuarantineNotification(String email, String username, LocalDateTime createdAt) {
        sendQuarantineNotification(email, username, createdAt, "ja");
    }

    /**
     * 警告通知（1回目の違反）
     */
    @Async
    public void sendWarningNotification(String email, String username, String reason, String language) {
        String subject;
        String body;

        if ("en".equals(language)) {
            subject = "【Photlas】Content Policy Violation Warning";
            body = "Hi " + username + ",\n\n"
                    + "Your content has been found to violate our content policy and has been removed.\n\n"
                    + "Reason: " + reason + "\n\n"
                    + "This is a warning. Repeated violations may result in suspension of posting privileges or account suspension.\n\n"
                    + "Please review our Terms of Service for details on our content policy."
                    + MAIL_SIGNATURE_EN;
        } else {
            subject = "【Photlas】コンテンツポリシー違反に関する警告";
            body = username + " さん\n\n"
                    + "投稿されたコンテンツがコンテンツポリシーに違反していると判断されたため、該当の投稿を削除いたしました。\n\n"
                    + "違反理由: " + reason + "\n\n"
                    + "これは警告です。今後同様の違反が繰り返された場合、投稿機能の停止やアカウントの停止などの措置を講じる場合があります。\n\n"
                    + "コンテンツポリシーの詳細については、利用規約をご確認ください。"
                    + MAIL_SIGNATURE_JA;
        }

        sendEmail(email, subject, body);
    }

    /**
     * 後方互換性のためのオーバーロード
     */
    @Async
    public void sendWarningNotification(String email, String username, String reason) {
        sendWarningNotification(email, username, reason, "ja");
    }

    /**
     * 一時停止通知（2回目の違反）
     */
    @Async
    public void sendTemporarySuspensionNotification(
            String email, String username, String reason, LocalDate suspendedUntil, String language) {
        String subject;
        String body;

        if ("en".equals(language)) {
            subject = "【Photlas】Posting Privileges Suspended";
            body = "Hi " + username + ",\n\n"
                    + "Due to multiple content policy violations, your posting privileges have been temporarily suspended.\n\n"
                    + "Reason: " + reason + "\n"
                    + "Suspended until: " + suspendedUntil + "\n\n"
                    + "During the suspension period, you will not be able to post photos, but you can continue to browse and use other features.\n\n"
                    + "Your posting privileges will be automatically restored after the suspension period.\n"
                    + "If you have any questions, please contact us."
                    + MAIL_SIGNATURE_EN;
        } else {
            subject = "【Photlas】投稿機能の一時停止について";
            body = username + " さん\n\n"
                    + "コンテンツポリシーへの複数回の違反が確認されたため、投稿機能を一時的に停止いたしました。\n\n"
                    + "違反理由: " + reason + "\n"
                    + "停止期間: " + suspendedUntil + " まで\n\n"
                    + "停止期間中は写真の投稿ができませんが、閲覧等その他の機能はご利用いただけます。\n\n"
                    + "停止期間終了後、自動的に投稿機能が復旧されます。\n"
                    + "ご不明な点がございましたら、お問い合わせください。"
                    + MAIL_SIGNATURE_JA;
        }

        sendEmail(email, subject, body);
    }

    /**
     * 後方互換性のためのオーバーロード
     */
    @Async
    public void sendTemporarySuspensionNotification(
            String email, String username, String reason, LocalDate suspendedUntil) {
        sendTemporarySuspensionNotification(email, username, reason, suspendedUntil, "ja");
    }

    /**
     * 永久停止通知（3回目以降の違反）
     */
    @Async
    public void sendPermanentSuspensionNotification(String email, String username, String reason, String language) {
        String subject;
        String body;

        if ("en".equals(language)) {
            subject = "【Photlas】Account Permanently Suspended";
            body = "Hi " + username + ",\n\n"
                    + "Due to repeated content policy violations, your account has been permanently suspended.\n\n"
                    + "Reason: " + reason + "\n\n"
                    + "This means you will no longer be able to log in or use any features of this service.\n"
                    + "All published content has been made private.\n\n"
                    + "If you wish to appeal this decision, please contact support@photlas.jp."
                    + MAIL_SIGNATURE_EN;
        } else {
            subject = "【Photlas】アカウントの永久停止について";
            body = username + " さん\n\n"
                    + "コンテンツポリシーへの度重なる違反が確認されたため、アカウントを永久停止いたしました。\n\n"
                    + "違反理由: " + reason + "\n\n"
                    + "この措置により、今後本サービスへのログインおよびすべての機能のご利用ができなくなります。\n"
                    + "また、公開中の投稿はすべて非公開となります。\n\n"
                    + "この措置に異議がある場合は、support@photlas.jp までご連絡ください。"
                    + MAIL_SIGNATURE_JA;
        }

        sendEmail(email, subject, body);
    }

    /**
     * 後方互換性のためのオーバーロード
     */
    @Async
    public void sendPermanentSuspensionNotification(String email, String username, String reason) {
        sendPermanentSuspensionNotification(email, username, reason, "ja");
    }

    /**
     * メールを送信する
     */
    private void sendEmail(String to, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
            logger.info("モデレーション通知メール送信完了: to={}, subject={}", to, subject);
        } catch (Exception e) {
            logger.error("モデレーション通知メール送信失敗: to={}, error={}", to, e.getMessage());
        }
    }
}
