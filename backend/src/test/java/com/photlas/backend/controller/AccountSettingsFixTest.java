package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.EmailVerificationToken;
import com.photlas.backend.entity.PasswordResetToken;
import com.photlas.backend.entity.User;
import com.photlas.backend.filter.RateLimitFilter;
import com.photlas.backend.repository.EmailVerificationTokenRepository;
import com.photlas.backend.repository.PasswordResetTokenRepository;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * アカウント設定精査レポート #3, #4, #5 の修正テスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AccountSettingsFixTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RateLimitFilter rateLimitFilter;
    @Autowired private EmailVerificationTokenRepository emailVerificationTokenRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;

    private User testUser;
    private String jwtToken;

    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_PASSWORD = "Password123";

    @BeforeEach
    void setUp() {
        rateLimitFilter.clearCache();
        emailVerificationTokenRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
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

    // ===== #3: 表示名バリデーション統一 =====

    @Test
    @DisplayName("#3 - 表示名13文字はバリデーションエラーになる（DB制約12文字に統一）")
    void testUpdateUsername_TooLong_ReturnsBadRequest() throws Exception {
        String requestBody = "{\"username\":\"1234567890abc\"}"; // 13文字

        mockMvc.perform(put("/api/v1/users/me/username")
                .with(csrf())
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("#3 - 表示名1文字はバリデーションエラーになる（最低2文字に統一）")
    void testUpdateUsername_TooShort_ReturnsBadRequest() throws Exception {
        String requestBody = "{\"username\":\"a\"}"; // 1文字

        mockMvc.perform(put("/api/v1/users/me/username")
                .with(csrf())
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    // ===== #4: S3キーの正当性チェック =====

    @Test
    @DisplayName("#4 - 他ユーザーのS3キーを指定した場合は400を返す")
    void testUpdateProfileImage_WrongUserPrefix_ReturnsBadRequest() throws Exception {
        String requestBody = "{\"objectKey\":\"profile-images/9999/fake.jpg\"}"; // 別ユーザーのID

        mockMvc.perform(put("/api/v1/users/me/profile-image")
                .with(csrf())
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("#4 - 正しいプレフィックスのS3キーは受け付ける")
    void testUpdateProfileImage_CorrectPrefix_ReturnsOk() throws Exception {
        String objectKey = "profile-images/" + testUser.getId() + "/test.jpg";
        String requestBody = "{\"objectKey\":\"" + objectKey + "\"}";

        mockMvc.perform(put("/api/v1/users/me/profile-image")
                .with(csrf())
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isOk());
    }

    // ===== #5: アカウント削除時のトークン削除 =====

    @Test
    @DisplayName("#5 - アカウント削除時にメール認証トークンが削除される")
    void testDeleteAccount_DeletesEmailVerificationToken() throws Exception {
        // トークンを作成
        EmailVerificationToken token = new EmailVerificationToken(
                testUser.getId(), "verify-token",
                new Date(System.currentTimeMillis() + 60 * 60 * 1000));
        emailVerificationTokenRepository.save(token);

        String requestBody = "{\"password\":\"" + TEST_PASSWORD + "\"}";

        mockMvc.perform(delete("/api/v1/users/me")
                .with(csrf())
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isNoContent());

        assertTrue(emailVerificationTokenRepository.findByUserId(testUser.getId()).isEmpty(),
                "メール認証トークンが削除されている");
    }

    @Test
    @DisplayName("#5 - アカウント削除時にパスワードリセットトークンが削除される")
    void testDeleteAccount_DeletesPasswordResetToken() throws Exception {
        PasswordResetToken token = new PasswordResetToken(
                testUser.getId(), "reset-token",
                new Date(System.currentTimeMillis() + 60 * 60 * 1000));
        passwordResetTokenRepository.save(token);

        String requestBody = "{\"password\":\"" + TEST_PASSWORD + "\"}";

        mockMvc.perform(delete("/api/v1/users/me")
                .with(csrf())
                .header("Authorization", "Bearer " + jwtToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody))
                .andExpect(status().isNoContent());

        assertTrue(passwordResetTokenRepository.findByUserId(testUser.getId()).isEmpty(),
                "パスワードリセットトークンが削除されている");
    }
}
