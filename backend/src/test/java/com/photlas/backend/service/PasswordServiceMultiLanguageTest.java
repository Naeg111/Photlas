package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PasswordResetTokenRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/**
 * Issue#113 フェーズ 2 - PasswordService の 5 言語化テスト。
 *
 * <p>{@code sendPasswordResetEmail} (グループ A: 失敗時例外伝播) と
 * {@code sendPasswordChangedNotification} (グループ C: 失敗時 WARN ログ) の
 * 5 言語対応を検証する。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PasswordServiceMultiLanguageTest {

    @Autowired private PasswordService passwordService;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;

    @MockBean private EmailService emailService;

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder();

    @BeforeEach
    void setUp() {
        passwordResetTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ========== パスワードリセット (グループ A) ==========

    @Test
    @DisplayName("Issue#113 - パスワードリセット: ja ユーザーには日本語メール")
    void resetEmailJa() {
        seedUser("ja", "ja-reset@example.com");

        passwordService.requestPasswordReset("ja-reset@example.com");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("ja-reset@example.com"), subjectCaptor.capture(), anyString());
        assertThat(subjectCaptor.getValue()).contains("Photlas").contains("パスワード");
    }

    @Test
    @DisplayName("Issue#113 - パスワードリセット: en ユーザーには英語メール")
    void resetEmailEn() {
        seedUser("en", "en-reset@example.com");

        passwordService.requestPasswordReset("en-reset@example.com");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("en-reset@example.com"), subjectCaptor.capture(), anyString());
        assertThat(subjectCaptor.getValue()).contains("Photlas").contains("Password");
    }

    @Test
    @DisplayName("Issue#113 - パスワードリセット: ko ユーザーには韓国語メール（ハングル含む）")
    void resetEmailKo() {
        seedUser("ko", "ko-reset@example.com");

        passwordService.requestPasswordReset("ko-reset@example.com");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("ko-reset@example.com"), subjectCaptor.capture(), anyString());
        assertThat(subjectCaptor.getValue()).matches(".*[\\uAC00-\\uD7AF].*");
    }

    @Test
    @DisplayName("Issue#113 - パスワードリセット: zh-CN ユーザーには簡体中文メール（CJK 含む）")
    void resetEmailZhCn() {
        seedUser("zh-CN", "zhcn-reset@example.com");

        passwordService.requestPasswordReset("zhcn-reset@example.com");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("zhcn-reset@example.com"), subjectCaptor.capture(), anyString());
        assertThat(subjectCaptor.getValue()).matches(".*[\\u4E00-\\u9FFF].*");
    }

    @Test
    @DisplayName("Issue#113 - パスワードリセット: zh-TW ユーザーには繁体中文メール（CJK 含む）")
    void resetEmailZhTw() {
        seedUser("zh-TW", "zhtw-reset@example.com");

        passwordService.requestPasswordReset("zhtw-reset@example.com");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("zhtw-reset@example.com"), subjectCaptor.capture(), anyString());
        assertThat(subjectCaptor.getValue()).matches(".*[\\u4E00-\\u9FFF].*");
    }

    @Test
    @DisplayName("Issue#113 - パスワードリセット (グループ A): メール送信失敗時に例外伝播")
    void resetEmailGroupAFailurePropagatesException() {
        seedUser("ja", "fail-reset@example.com");
        doThrow(new RuntimeException("SMTP error"))
                .when(emailService).send(anyString(), anyString(), anyString());

        assertThatThrownBy(() -> passwordService.requestPasswordReset("fail-reset@example.com"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("SMTP error");
    }

    // ========== パスワード変更完了通知 (グループ C) ==========

    @Test
    @DisplayName("Issue#113 - パスワード変更通知: ja ユーザーには日本語メール")
    void changedEmailJa() {
        User user = seedUser("ja", "ja-changed@example.com");

        passwordService.updatePassword("ja-changed@example.com", "Password1", "NewPass2");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("ja-changed@example.com"), subjectCaptor.capture(), anyString());
        assertThat(subjectCaptor.getValue()).contains("Photlas").contains("パスワード");
    }

    @Test
    @DisplayName("Issue#113 - パスワード変更通知: en ユーザーには英語メール")
    void changedEmailEn() {
        seedUser("en", "en-changed@example.com");

        passwordService.updatePassword("en-changed@example.com", "Password1", "NewPass2");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("en-changed@example.com"), subjectCaptor.capture(), anyString());
        assertThat(subjectCaptor.getValue()).contains("Photlas").contains("Password");
    }

    @Test
    @DisplayName("Issue#113 - パスワード変更通知: ko ユーザーには韓国語メール")
    void changedEmailKo() {
        seedUser("ko", "ko-changed@example.com");

        passwordService.updatePassword("ko-changed@example.com", "Password1", "NewPass2");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("ko-changed@example.com"), subjectCaptor.capture(), anyString());
        assertThat(subjectCaptor.getValue()).matches(".*[\\uAC00-\\uD7AF].*");
    }

    @Test
    @DisplayName("Issue#113 - パスワード変更通知 (グループ C): メール送信失敗でも処理は成功扱い")
    void changedEmailGroupCFailureSwallowed() {
        seedUser("ja", "fail-changed@example.com");
        doThrow(new RuntimeException("SMTP error"))
                .when(emailService).send(anyString(), anyString(), anyString());

        // メール送信失敗でも updatePassword は完了する（例外を投げない）
        passwordService.updatePassword("fail-changed@example.com", "Password1", "NewPass2");

        // パスワードが実際に変更されていることを確認
        User reloaded = userRepository.findByEmail("fail-changed@example.com").orElseThrow();
        assertThat(ENCODER.matches("NewPass2", reloaded.getPasswordHash())).isTrue();
    }

    private User seedUser(String language, String email) {
        User user = new User();
        user.setUsername(language + "_user");
        user.setEmail(email);
        user.setPasswordHash(ENCODER.encode("Password1"));
        user.setRole(CodeConstants.ROLE_USER);
        user.setEmailVerified(true);
        user.setLanguage(language);
        return userRepository.saveAndFlush(user);
    }
}
