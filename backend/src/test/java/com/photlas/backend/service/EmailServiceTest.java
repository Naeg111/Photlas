package com.photlas.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * EmailServiceのユニットテスト
 */
@ExtendWith(MockitoExtension.class)
public class EmailServiceTest {

    @Mock
    private JavaMailSender mailSender;

    @InjectMocks
    private EmailService emailService;

    @Test
    @DisplayName("メール送信が正常に行われる")
    void testSendEmail_Success() {
        emailService.send("test@example.com", "件名", "本文");

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender).send(captor.capture());

        SimpleMailMessage message = captor.getValue();
        assertThat(message.getTo()).containsExactly("test@example.com");
        assertThat(message.getSubject()).isEqualTo("件名");
        assertThat(message.getText()).isEqualTo("本文");
    }

    @Test
    @DisplayName("メール送信失敗時に例外がそのままスローされる")
    void testSendEmail_Failure_ThrowsException() {
        doThrow(new MailSendException("SMTP error"))
                .when(mailSender).send(any(SimpleMailMessage.class));

        assertThatThrownBy(() -> emailService.send("test@example.com", "件名", "本文"))
                .isInstanceOf(MailSendException.class);
    }
}
