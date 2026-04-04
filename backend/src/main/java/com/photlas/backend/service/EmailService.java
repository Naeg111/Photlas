package com.photlas.backend.service;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * メール送信サービス
 * メール送信の共通ロジックを提供する。
 * 送信失敗時は例外をそのままスローし、エラーハンドリングは呼び出し元に委ねる。
 */
@Service
public class EmailService {

    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /**
     * メールを送信する
     *
     * @param to 宛先メールアドレス
     * @param subject 件名
     * @param body 本文
     */
    public void send(String to, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
    }
}
