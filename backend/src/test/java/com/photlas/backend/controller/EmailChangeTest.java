package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.entity.EmailChangeToken;
import com.photlas.backend.entity.User;
import com.photlas.backend.filter.RateLimitFilter;
import com.photlas.backend.repository.EmailChangeTokenRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Issue#86: メールアドレス変更時の確認メール送信機能
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class EmailChangeTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailChangeTokenRepository emailChangeTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    private User testUser;
    private String jwtToken;

    private static final String TEST_EMAIL = "test@example.com";
    private static final String NEW_EMAIL = "new@example.com";
    private static final String TEST_PASSWORD = "Password123";
    private static final String EMAIL_CHANGE_REQUEST_ENDPOINT = "/api/v1/users/me/email";
    private static final String EMAIL_CHANGE_CONFIRM_ENDPOINT = "/api/v1/auth/confirm-email-change";

    @BeforeEach
    void setUp() {
        rateLimitFilter.clearCache();
        emailChangeTokenRepository.deleteAll();
        userRepository.deleteAll();

        testUser = new User();
        testUser.setUsername("testuser");
        testUser.setEmail(TEST_EMAIL);
        testUser.setPasswordHash(passwordEncoder.encode(TEST_PASSWORD));
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser.setEmailVerified(true);
        testUser = userRepository.save(testUser);

        jwtToken = jwtService.generateTokenWithRole(TEST_EMAIL, "USER");
    }

    // ===== メールアドレス変更リクエスト =====

    @Test
    @DisplayName("Issue#86 - メール変更リクエスト: 確認メール送信のメッセージが返る（即座に変更されない）")
    void testEmailChangeRequest_ReturnsConfirmationMessage() throws Exception {
        String requestBody = String.format(
                "{\"new_email\":\"%s\",\"current_password\":\"%s\"}", NEW_EMAIL, TEST_PASSWORD);

        mockMvc.perform(put(EMAIL_CHANGE_REQUEST_ENDPOINT)
                .with(csrf())
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());

        // メールアドレスはまだ変更されていないことを確認
        User user = userRepository.findById(testUser.getId()).orElseThrow();
        assertEquals(TEST_EMAIL, user.getEmail(), "メールアドレスはまだ変更されていない");
    }

    @Test
    @DisplayName("Issue#86 - メール変更リクエスト: 確認トークンがDBに保存される")
    void testEmailChangeRequest_SavesTokenToDb() throws Exception {
        String requestBody = String.format(
                "{\"new_email\":\"%s\",\"current_password\":\"%s\"}", NEW_EMAIL, TEST_PASSWORD);

        mockMvc.perform(put(EMAIL_CHANGE_REQUEST_ENDPOINT)
                .with(csrf())
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk());

        // トークンがDBに保存されていることを確認
        EmailChangeToken token = emailChangeTokenRepository.findByUserId(testUser.getId()).orElse(null);
        assertNotNull(token, "確認トークンがDBに保存されている");
        assertEquals(NEW_EMAIL, token.getNewEmail(), "新メールアドレスがトークンに記録されている");
        assertNotNull(token.getToken(), "トークン文字列が生成されている");
        assertNotNull(token.getExpiryDate(), "有効期限が設定されている");
    }

    @Test
    @DisplayName("Issue#86 - メール変更リクエスト: パスワード不正の場合は401を返す")
    void testEmailChangeRequest_WrongPassword_ReturnsUnauthorized() throws Exception {
        String requestBody = String.format(
                "{\"new_email\":\"%s\",\"current_password\":\"WrongPass1\"}", NEW_EMAIL);

        mockMvc.perform(put(EMAIL_CHANGE_REQUEST_ENDPOINT)
                .with(csrf())
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Issue#86 - メール変更リクエスト: 同じメールアドレスの場合は400を返す")
    void testEmailChangeRequest_SameEmail_ReturnsBadRequest() throws Exception {
        String requestBody = String.format(
                "{\"new_email\":\"%s\",\"current_password\":\"%s\"}", TEST_EMAIL, TEST_PASSWORD);

        mockMvc.perform(put(EMAIL_CHANGE_REQUEST_ENDPOINT)
                .with(csrf())
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    // ===== メールアドレス変更確認 =====

    @Test
    @DisplayName("Issue#86 - メール変更確認: 有効なトークンでメールアドレスが変更される")
    void testEmailChangeConfirm_ValidToken_ChangesEmail() throws Exception {
        // トークンを直接DBに作成
        EmailChangeToken token = new EmailChangeToken(
                testUser.getId(), NEW_EMAIL, "valid-token",
                new Date(System.currentTimeMillis() + 30 * 60 * 1000));
        emailChangeTokenRepository.save(token);

        mockMvc.perform(get(EMAIL_CHANGE_CONFIRM_ENDPOINT)
                .param("token", "valid-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", is(NEW_EMAIL)))
                .andExpect(jsonPath("$.token").exists());

        // メールアドレスが変更されていることを確認
        User user = userRepository.findById(testUser.getId()).orElseThrow();
        assertEquals(NEW_EMAIL, user.getEmail(), "メールアドレスが変更されている");
    }

    @Test
    @DisplayName("Issue#86 - メール変更確認: 無効なトークンの場合は400を返す")
    void testEmailChangeConfirm_InvalidToken_ReturnsBadRequest() throws Exception {
        mockMvc.perform(get(EMAIL_CHANGE_CONFIRM_ENDPOINT)
                .param("token", "invalid-token"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#86 - メール変更確認: 期限切れトークンの場合は400を返す")
    void testEmailChangeConfirm_ExpiredToken_ReturnsBadRequest() throws Exception {
        EmailChangeToken token = new EmailChangeToken(
                testUser.getId(), NEW_EMAIL, "expired-token",
                new Date(System.currentTimeMillis() - 60 * 1000));
        emailChangeTokenRepository.save(token);

        mockMvc.perform(get(EMAIL_CHANGE_CONFIRM_ENDPOINT)
                .param("token", "expired-token"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#86 - メール変更確認: 確認後にトークンが削除される")
    void testEmailChangeConfirm_DeletesTokenAfterConfirmation() throws Exception {
        EmailChangeToken token = new EmailChangeToken(
                testUser.getId(), NEW_EMAIL, "delete-test-token",
                new Date(System.currentTimeMillis() + 30 * 60 * 1000));
        emailChangeTokenRepository.save(token);

        mockMvc.perform(get(EMAIL_CHANGE_CONFIRM_ENDPOINT)
                .param("token", "delete-test-token"))
                .andExpect(status().isOk());

        assertTrue(emailChangeTokenRepository.findByToken("delete-test-token").isEmpty(),
                "使用済みトークンが削除されている");
    }

    @Test
    @DisplayName("Issue#86 - メール変更確認: 新メールが他ユーザーに使用中の場合は409を返す")
    void testEmailChangeConfirm_EmailTaken_ReturnsConflict() throws Exception {
        // 別ユーザーが新メールアドレスを使用
        User otherUser = new User();
        otherUser.setUsername("other");
        otherUser.setEmail(NEW_EMAIL);
        otherUser.setPasswordHash("hash");
        otherUser.setRole(CodeConstants.ROLE_USER);
        userRepository.save(otherUser);

        EmailChangeToken token = new EmailChangeToken(
                testUser.getId(), NEW_EMAIL, "conflict-token",
                new Date(System.currentTimeMillis() + 30 * 60 * 1000));
        emailChangeTokenRepository.save(token);

        mockMvc.perform(get(EMAIL_CHANGE_CONFIRM_ENDPOINT)
                .param("token", "conflict-token"))
                .andExpect(status().isConflict());
    }
}
