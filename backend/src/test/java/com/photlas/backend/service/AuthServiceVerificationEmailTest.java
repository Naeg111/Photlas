package com.photlas.backend.service;

import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/**
 * Issue#113 フェーズ 1 - AuthService.sendVerificationEmail の 5 言語化テスト。
 *
 * <p>新規登録時に送信されるメール認証リンクが、ユーザーの登録言語に応じて
 * 適切な言語で送信されることを検証する。グループ A (HTTP 失敗扱い) のため、
 * メール送信失敗時は例外が呼び出し元へ伝播することも検証する。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AuthServiceVerificationEmailTest {

    @Autowired private AuthService authService;
    @Autowired private UserRepository userRepository;

    @MockBean private EmailService emailService;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("Issue#113 - ja ユーザー登録時に日本語の認証メールが送信される")
    void registersAndSendsJapaneseVerificationEmail() {
        RegisterRequest req = makeRequest("ja_user", "ja@example.com", "ja");
        authService.registerUser(req, "ja");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("ja@example.com"), subjectCaptor.capture(), bodyCaptor.capture());

        assertThat(subjectCaptor.getValue()).contains("Photlas").contains("メールアドレス");
        assertThat(bodyCaptor.getValue()).contains("ja_user");
        assertThat(bodyCaptor.getValue()).contains("/verify-email?token=");
    }

    @Test
    @DisplayName("Issue#113 - en ユーザー登録時に英語の認証メールが送信される")
    void registersAndSendsEnglishVerificationEmail() {
        RegisterRequest req = makeRequest("en_user", "en@example.com", "en");
        authService.registerUser(req, "en");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("en@example.com"), subjectCaptor.capture(), anyString());
        assertThat(subjectCaptor.getValue()).contains("Photlas").contains("Verification");
    }

    @Test
    @DisplayName("Issue#113 - ko ユーザー登録時に韓国語の認証メールが送信される")
    void registersAndSendsKoreanVerificationEmail() {
        RegisterRequest req = makeRequest("ko_user", "ko@example.com", "ko");
        authService.registerUser(req, "ko");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("ko@example.com"), subjectCaptor.capture(), anyString());
        // ハングル文字
        assertThat(subjectCaptor.getValue()).matches(".*[\\uAC00-\\uD7AF].*");
    }

    @Test
    @DisplayName("Issue#113 - zh-CN ユーザー登録時に簡体中文の認証メールが送信される")
    void registersAndSendsChineseSimplifiedVerificationEmail() {
        RegisterRequest req = makeRequest("zh_cn_user", "zhcn@example.com", "zh-CN");
        authService.registerUser(req, "zh-CN");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("zhcn@example.com"), subjectCaptor.capture(), anyString());
        assertThat(subjectCaptor.getValue()).matches(".*[\\u4E00-\\u9FFF].*");
    }

    @Test
    @DisplayName("Issue#113 - zh-TW ユーザー登録時に繁体中文の認証メールが送信される")
    void registersAndSendsChineseTraditionalVerificationEmail() {
        RegisterRequest req = makeRequest("zh_tw_user", "zhtw@example.com", "zh-TW");
        authService.registerUser(req, "zh-TW");

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("zhtw@example.com"), subjectCaptor.capture(), anyString());
        assertThat(subjectCaptor.getValue()).matches(".*[\\u4E00-\\u9FFF].*");
    }

    @Test
    @DisplayName("Issue#113 - グループ A: メール送信失敗時に例外が呼び出し元へ伝播する")
    void groupAFailurePropagatesException() {
        doThrow(new RuntimeException("SMTP server unreachable"))
                .when(emailService).send(anyString(), anyString(), anyString());

        RegisterRequest req = makeRequest("fail_user", "fail@example.com", "ja");

        assertThatThrownBy(() -> authService.registerUser(req, "ja"))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("SMTP server unreachable");
    }

    private RegisterRequest makeRequest(String username, String email, String language) {
        RegisterRequest req = new RegisterRequest();
        req.setUsername(username);
        req.setEmail(email);
        req.setPassword("Password1");
        // language は registerUser 第 2 引数で指定するため req には含めない
        return req;
    }
}
