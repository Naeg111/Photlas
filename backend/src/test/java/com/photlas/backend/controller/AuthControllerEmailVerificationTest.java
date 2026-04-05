package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.entity.EmailVerificationToken;
import com.photlas.backend.entity.User;
import com.photlas.backend.filter.RateLimitFilter;
import com.photlas.backend.repository.EmailVerificationTokenRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.Optional;
import java.util.UUID;

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * メール認証機能のテスト
 *
 * 対象エンドポイント:
 * - GET /api/v1/auth/verify-email?token=xxx
 * - POST /api/v1/auth/resend-verification
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AuthControllerEmailVerificationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private EmailVerificationTokenRepository emailVerificationTokenRepository;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    // テストデータ定数
    private static final String TEST_USERNAME = "testuser";
    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_PASSWORD = "Password123";
    private static final String VALID_TOKEN = "valid-test-token-12345";

    // エンドポイント定数
    private static final String VERIFY_EMAIL_ENDPOINT = "/api/v1/auth/verify-email";
    private static final String RESEND_VERIFICATION_ENDPOINT = "/api/v1/auth/resend-verification";
    private static final String REGISTER_ENDPOINT = "/api/v1/auth/register";

    private User testUser;

    @BeforeEach
    void setUp() {
        emailVerificationTokenRepository.deleteAll();
        userRepository.deleteAll();
        rateLimitFilter.clearCache();

        // メール未認証のテストユーザーを作成
        testUser = new User();
        testUser.setUsername(TEST_USERNAME);
        testUser.setEmail(TEST_EMAIL);
        testUser.setPasswordHash(passwordEncoder.encode(TEST_PASSWORD));
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser.setEmailVerified(false);
        testUser = userRepository.save(testUser);
    }

    /**
     * 有効な認証トークンを作成するヘルパーメソッド
     */
    private EmailVerificationToken createValidToken(Long userId, String tokenValue) {
        Date expiryDate = new Date(System.currentTimeMillis() + 24 * 60 * 60 * 1000);
        EmailVerificationToken token = new EmailVerificationToken(userId, tokenValue, expiryDate);
        return emailVerificationTokenRepository.save(token);
    }

    /**
     * 期限切れの認証トークンを作成するヘルパーメソッド
     */
    private EmailVerificationToken createExpiredToken(Long userId, String tokenValue) {
        Date expiryDate = new Date(System.currentTimeMillis() - 1000);
        EmailVerificationToken token = new EmailVerificationToken(userId, tokenValue, expiryDate);
        return emailVerificationTokenRepository.save(token);
    }

    // ==========================================
    // メールアドレス認証テスト (GET /verify-email)
    // ==========================================

    @Test
    @DisplayName("有効なトークンでメール認証 - 200 OK")
    void testVerifyEmail_ValidToken_ReturnsOk() throws Exception {
        createValidToken(testUser.getId(), VALID_TOKEN);

        mockMvc.perform(get(VERIFY_EMAIL_ENDPOINT)
                .param("token", VALID_TOKEN))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", is("メールアドレスの認証が完了しました。ログインしてください。")));

        // ユーザーのemailVerifiedがtrueになっていることを確認
        User updatedUser = userRepository.findById(testUser.getId()).orElseThrow();
        assertTrue(updatedUser.isEmailVerified());
    }

    @Test
    @DisplayName("認証後にトークンが削除されること")
    void testVerifyEmail_TokenDeletedAfterVerification() throws Exception {
        createValidToken(testUser.getId(), VALID_TOKEN);

        mockMvc.perform(get(VERIFY_EMAIL_ENDPOINT)
                .param("token", VALID_TOKEN))
                .andExpect(status().isOk());

        // トークンが削除されていることを確認
        Optional<EmailVerificationToken> deletedToken =
                emailVerificationTokenRepository.findByToken(VALID_TOKEN);
        assertTrue(deletedToken.isEmpty());
    }

    @Test
    @DisplayName("無効なトークンでメール認証 - 400 Bad Request")
    void testVerifyEmail_InvalidToken_ReturnsBadRequest() throws Exception {
        mockMvc.perform(get(VERIFY_EMAIL_ENDPOINT)
                .param("token", "invalid-token"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("認証トークンが無効または期限切れです")));
    }

    @Test
    @DisplayName("期限切れトークンでメール認証 - 400 Bad Request")
    void testVerifyEmail_ExpiredToken_ReturnsBadRequest() throws Exception {
        createExpiredToken(testUser.getId(), "expired-token");

        mockMvc.perform(get(VERIFY_EMAIL_ENDPOINT)
                .param("token", "expired-token"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("認証トークンが無効または期限切れです")));

        // ユーザーのemailVerifiedがfalseのままであることを確認
        User unchangedUser = userRepository.findById(testUser.getId()).orElseThrow();
        assertFalse(unchangedUser.isEmailVerified());
    }

    // ==========================================
    // 認証メール再送テスト (POST /resend-verification)
    // ==========================================

    @Test
    @DisplayName("未認証ユーザーに認証メール再送 - 200 OK")
    void testResendVerification_UnverifiedUser_ReturnsOk() throws Exception {
        String requestBody = "{\"email\": \"" + TEST_EMAIL + "\"}";

        mockMvc.perform(post(RESEND_VERIFICATION_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", is("認証メールを再送信しました。メールをご確認ください。")));

        // トークンが生成されていることを確認
        Optional<EmailVerificationToken> newToken =
                emailVerificationTokenRepository.findByUserId(testUser.getId());
        assertTrue(newToken.isPresent());
    }

    @Test
    @DisplayName("存在しないメールアドレスで認証メール再送 - 200 OK（セキュリティ考慮）")
    void testResendVerification_NonexistentEmail_ReturnsOk() throws Exception {
        String requestBody = "{\"email\": \"nonexistent@example.com\"}";

        // セキュリティ上、存在しないメールでも同じレスポンスを返す
        mockMvc.perform(post(RESEND_VERIFICATION_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", is("認証メールを再送信しました。メールをご確認ください。")));
    }

    @Test
    @DisplayName("認証済みユーザーに認証メール再送 - 400 Bad Request")
    void testResendVerification_AlreadyVerifiedUser_ReturnsBadRequest() throws Exception {
        // ユーザーを認証済みにする
        testUser.setEmailVerified(true);
        userRepository.save(testUser);

        String requestBody = "{\"email\": \"" + TEST_EMAIL + "\"}";

        mockMvc.perform(post(RESEND_VERIFICATION_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("このメールアドレスは既に認証済みです")));
    }

    @Test
    @DisplayName("メールアドレスなしで認証メール再送 - 400 Bad Request")
    void testResendVerification_MissingEmail_ReturnsBadRequest() throws Exception {
        String requestBody = "{}";

        mockMvc.perform(post(RESEND_VERIFICATION_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("メールアドレスは必須です")));
    }

    // ==========================================
    // ユーザー登録時のメール認証トークン生成テスト
    // ==========================================

    @Test
    @DisplayName("ユーザー登録時に認証トークンが生成される")
    void testRegister_CreatesVerificationToken() throws Exception {
        String registerRequest = """
                {
                    "username": "newuser",
                    "email": "newuser@example.com",
                    "password": "Password123"
                }
                """;

        mockMvc.perform(post(REGISTER_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(registerRequest))
                .andExpect(status().isCreated());

        // 登録されたユーザーを取得
        User newUser = userRepository.findByEmail("newuser@example.com").orElseThrow();

        // emailVerifiedがfalseであること
        assertFalse(newUser.isEmailVerified());

        // 認証トークンが生成されていること
        Optional<EmailVerificationToken> token =
                emailVerificationTokenRepository.findByUserId(newUser.getId());
        assertTrue(token.isPresent());
        assertNotNull(token.get().getToken());
        assertTrue(token.get().getExpiryDate().after(new Date()));
    }
}
