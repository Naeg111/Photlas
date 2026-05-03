package com.photlas.backend.service;

import com.photlas.backend.dto.UpdateEmailRequest;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
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
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;

/**
 * Issue#113 フェーズ 3 - AccountService の 5 言語化テスト。
 *
 * <p>3 メール（メール変更確認リンク・旧アドレス通知・アカウント削除完了通知）の
 * 言語別出力 + メール変更時の送信順序 (旧アドレス先 → 新アドレス後) +
 * グループ A/C の失敗時挙動を検証する。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AccountServiceMultiLanguageTest {

    @Autowired private AccountService accountService;
    @Autowired private UserRepository userRepository;
    @Autowired private UserOAuthConnectionRepository userOAuthConnectionRepository;

    @MockBean private EmailService emailService;

    private static final BCryptPasswordEncoder ENCODER = new BCryptPasswordEncoder();
    private static final String CURRENT_PASSWORD = "Password1";

    @BeforeEach
    void setUp() {
        userOAuthConnectionRepository.deleteAll();
        userRepository.deleteAll();
    }

    // ========== メールアドレス変更 (グループ A) ==========

    @Test
    @DisplayName("Issue#113 - メール変更: 旧アドレスへのアラートが新アドレスへのリンクより先に送信される")
    void emailChangeAlertSentBeforeLink() {
        User user = seedUser("ja", "old-order@example.com");

        accountService.requestEmailChange("old-order@example.com",
                "new-order@example.com", CURRENT_PASSWORD);

        InOrder order = inOrder(emailService);
        // 1 通目: 旧アドレスへのセキュリティ通知
        order.verify(emailService).send(eq("old-order@example.com"), anyString(), anyString());
        // 2 通目: 新アドレスへの確認リンク
        order.verify(emailService).send(eq("new-order@example.com"), anyString(), anyString());
    }

    @Test
    @DisplayName("Issue#113 - メール変更 ko: 5 言語化されたメールが送信される（ハングル件名）")
    void emailChangeKo() {
        User user = seedUser("ko", "old-ko@example.com");

        accountService.requestEmailChange("old-ko@example.com",
                "new-ko@example.com", CURRENT_PASSWORD);

        ArgumentCaptor<String> oldSubject = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("old-ko@example.com"), oldSubject.capture(), anyString());
        assertThat(oldSubject.getValue()).matches(".*[\\uAC00-\\uD7AF].*");

        ArgumentCaptor<String> newSubject = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("new-ko@example.com"), newSubject.capture(), anyString());
        assertThat(newSubject.getValue()).matches(".*[\\uAC00-\\uD7AF].*");
    }

    @Test
    @DisplayName("Issue#113 - メール変更 zh-CN: 簡体中文の件名が送信される")
    void emailChangeZhCn() {
        User user = seedUser("zh-CN", "old-zhcn@example.com");

        accountService.requestEmailChange("old-zhcn@example.com",
                "new-zhcn@example.com", CURRENT_PASSWORD);

        ArgumentCaptor<String> newSubject = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("new-zhcn@example.com"), newSubject.capture(), anyString());
        assertThat(newSubject.getValue()).matches(".*[\\u4E00-\\u9FFF].*");
    }

    @Test
    @DisplayName("Issue#113 - メール変更 zh-TW: 繁体中文の件名が送信される")
    void emailChangeZhTw() {
        User user = seedUser("zh-TW", "old-zhtw@example.com");

        accountService.requestEmailChange("old-zhtw@example.com",
                "new-zhtw@example.com", CURRENT_PASSWORD);

        ArgumentCaptor<String> newSubject = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("new-zhtw@example.com"), newSubject.capture(), anyString());
        assertThat(newSubject.getValue()).matches(".*[\\u4E00-\\u9FFF].*");
    }

    @Test
    @DisplayName("Issue#113 - メール変更 (グループ A): 旧アドレス送信失敗時に例外伝播し新アドレスは送信されない")
    void emailChangeOldAddrFailureBlocksNewAddr() {
        User user = seedUser("ja", "old-fail@example.com");
        // 旧アドレスへの送信のみ失敗させる
        doThrow(new RuntimeException("SMTP error - old addr"))
                .when(emailService).send(eq("old-fail@example.com"), anyString(), anyString());

        assertThatThrownBy(() -> accountService.requestEmailChange(
                "old-fail@example.com", "new-fail@example.com", CURRENT_PASSWORD))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("SMTP error - old addr");

        // 新アドレスへの送信は試みられないこと（旧アドレスを先に送る方針）
        verify(emailService, org.mockito.Mockito.never())
                .send(eq("new-fail@example.com"), anyString(), anyString());
    }

    // ========== アカウント削除 (グループ C) ==========

    @Test
    @DisplayName("Issue#113 - アカウント削除 NORMAL ja: 通常ユーザーの日本語確認メール")
    void deletionNormalJa() {
        User user = seedUser("ja", "del-normal-ja@example.com");

        accountService.deleteAccount("del-normal-ja@example.com", CURRENT_PASSWORD, false);

        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("del-normal-ja@example.com"), anyString(), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue())
                .contains("90日")
                .contains("メールアドレスとパスワード");
    }

    @Test
    @DisplayName("Issue#113 - アカウント削除 NORMAL en: 通常ユーザーの英語確認メール")
    void deletionNormalEn() {
        User user = seedUser("en", "del-normal-en@example.com");

        accountService.deleteAccount("del-normal-en@example.com", CURRENT_PASSWORD, false);

        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("del-normal-en@example.com"), anyString(), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue())
                .contains("90 days")
                .contains("email and password");
    }

    @Test
    @DisplayName("Issue#113 - アカウント削除 HYBRID ja: パスワード + プロバイダ両方の復旧経路を案内")
    void deletionHybridJa() {
        User user = seedUser("ja", "del-hybrid-ja@example.com");
        addOauthConnection(user, OAuthProvider.GOOGLE);

        accountService.deleteAccount("del-hybrid-ja@example.com", CURRENT_PASSWORD, false);

        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("del-hybrid-ja@example.com"), anyString(), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue())
                .contains("メールアドレスとパスワード")
                .contains("Google")
                .contains("90日");
    }

    @Test
    @DisplayName("Issue#113 - アカウント削除 OAUTH_ONLY ja: プロバイダ再サインインのみ案内")
    void deletionOauthOnlyJa() {
        User user = seedOauthOnlyUser("ja", "del-oauth-ja@example.com");
        addOauthConnection(user, OAuthProvider.GOOGLE);

        accountService.deleteAccount("del-oauth-ja@example.com", null, true);

        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("del-oauth-ja@example.com"), anyString(), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue())
                .contains("Google")
                .contains("90日")
                // OAUTH_ONLY なので「メールアドレスとパスワード」は含まない
                .doesNotContain("メールアドレスとパスワード");
    }

    @Test
    @DisplayName("Issue#113 - アカウント削除 ko: ハングル件名")
    void deletionKo() {
        User user = seedUser("ko", "del-ko@example.com");

        accountService.deleteAccount("del-ko@example.com", CURRENT_PASSWORD, false);

        ArgumentCaptor<String> subjectCaptor = ArgumentCaptor.forClass(String.class);
        verify(emailService).send(eq("del-ko@example.com"), subjectCaptor.capture(), anyString());
        assertThat(subjectCaptor.getValue()).matches(".*[\\uAC00-\\uD7AF].*");
    }

    @Test
    @DisplayName("Issue#113 - アカウント削除 (グループ C): メール送信失敗でも削除処理は完了する")
    void deletionGroupCFailureSwallowed() {
        User user = seedUser("ja", "del-fail@example.com");
        doThrow(new RuntimeException("SMTP error"))
                .when(emailService).send(anyString(), anyString(), anyString());

        accountService.deleteAccount("del-fail@example.com", CURRENT_PASSWORD, false);

        // メール送信失敗でも、ユーザーは論理削除されている
        User reloaded = userRepository.findByEmail("del-fail@example.com").orElseThrow();
        assertThat(reloaded.getDeletedAt()).isNotNull();
    }

    // ========== Helpers ==========

    private User seedUser(String language, String email) {
        User user = new User();
        user.setUsername("acct_" + language.replace("-", ""));
        user.setEmail(email);
        user.setPasswordHash(ENCODER.encode(CURRENT_PASSWORD));
        user.setRole(CodeConstants.ROLE_USER);
        user.setEmailVerified(true);
        user.setLanguage(language);
        return userRepository.saveAndFlush(user);
    }

    private User seedOauthOnlyUser(String language, String email) {
        User user = new User();
        user.setUsername("oauth_" + language.replace("-", ""));
        user.setEmail(email);
        user.setPasswordHash(null); // OAuth のみ
        user.setRole(CodeConstants.ROLE_USER);
        user.setEmailVerified(true);
        user.setLanguage(language);
        return userRepository.saveAndFlush(user);
    }

    private void addOauthConnection(User user, OAuthProvider provider) {
        UserOAuthConnection conn = new UserOAuthConnection();
        conn.setUserId(user.getId());
        conn.setProviderCode(provider.getCode());
        conn.setProviderUserId("provider-uid-" + user.getId());
        conn.setEmail(user.getEmail());
        userOAuthConnectionRepository.saveAndFlush(conn);
    }
}
