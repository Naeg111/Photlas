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

/**
 * Issue#54: モデレーション関連のメール通知サービス
 * 隔離・警告・停止・永久停止時にユーザーへメール通知を送信する
 */
@Service
public class ModerationNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(ModerationNotificationService.class);
    private static final String MAIL_SIGNATURE = "\n\nPhotlas チーム\nsupport@photlas.jp";

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:noreply@photlas.jp}")
    private String mailFrom;

    public ModerationNotificationService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /**
     * 写真が隔離された場合の通知
     *
     * @param email ユーザーのメールアドレス
     * @param username ユーザー名
     * @param createdAt 写真の投稿日時
     */
    @Async
    public void sendQuarantineNotification(String email, String username, LocalDateTime createdAt) {
        String subject = "【Photlas】投稿の審査について";
        String body = username + " さん\n\n"
                + "投稿された写真（" + createdAt.format(DateTimeFormatter.ofPattern("yyyy年MM月dd日 HH:mm")) + " 投稿）について、コンテンツポリシーに基づく審査が必要と判断されました。\n\n"
                + "現在、運営チームによる確認を行っております。審査の結果、問題がないと判断された場合は自動的に公開されます。\n\n"
                + "審査には通常1〜2営業日程度かかります。\n"
                + "ご不明な点がございましたら、お問い合わせください。"
                + MAIL_SIGNATURE;

        sendEmail(email, subject, body);
    }

    /**
     * 警告通知（1回目の違反）
     *
     * @param email ユーザーのメールアドレス
     * @param username ユーザー名
     * @param reason 違反理由
     */
    @Async
    public void sendWarningNotification(String email, String username, String reason) {
        String subject = "【Photlas】コンテンツポリシー違反に関する警告";
        String body = username + " さん\n\n"
                + "投稿されたコンテンツがコンテンツポリシーに違反していると判断されたため、該当の投稿を削除いたしました。\n\n"
                + "違反理由: " + reason + "\n\n"
                + "これは警告です。今後同様の違反が繰り返された場合、投稿機能の停止やアカウントの停止などの措置を講じる場合があります。\n\n"
                + "コンテンツポリシーの詳細については、利用規約をご確認ください。"
                + MAIL_SIGNATURE;

        sendEmail(email, subject, body);
    }

    /**
     * 一時停止通知（2回目の違反）
     *
     * @param email ユーザーのメールアドレス
     * @param username ユーザー名
     * @param reason 違反理由
     * @param suspendedUntil 停止解除日
     */
    @Async
    public void sendTemporarySuspensionNotification(
            String email, String username, String reason, LocalDate suspendedUntil) {
        String subject = "【Photlas】投稿機能の一時停止について";
        String body = username + " さん\n\n"
                + "コンテンツポリシーへの複数回の違反が確認されたため、投稿機能を一時的に停止いたしました。\n\n"
                + "違反理由: " + reason + "\n"
                + "停止期間: " + suspendedUntil + " まで\n\n"
                + "停止期間中は写真の投稿ができませんが、閲覧等その他の機能はご利用いただけます。\n\n"
                + "停止期間終了後、自動的に投稿機能が復旧されます。\n"
                + "ご不明な点がございましたら、お問い合わせください。"
                + MAIL_SIGNATURE;

        sendEmail(email, subject, body);
    }

    /**
     * 永久停止通知（3回目以降の違反）
     *
     * @param email ユーザーのメールアドレス
     * @param username ユーザー名
     * @param reason 違反理由
     */
    @Async
    public void sendPermanentSuspensionNotification(String email, String username, String reason) {
        String subject = "【Photlas】アカウントの永久停止について";
        String body = username + " さん\n\n"
                + "コンテンツポリシーへの度重なる違反が確認されたため、アカウントを永久停止いたしました。\n\n"
                + "違反理由: " + reason + "\n\n"
                + "この措置により、今後本サービスへのログインおよびすべての機能のご利用ができなくなります。\n"
                + "また、公開中の投稿はすべて非公開となります。\n\n"
                + "この措置に異議がある場合は、support@photlas.jp までご連絡ください。"
                + MAIL_SIGNATURE;

        sendEmail(email, subject, body);
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
