package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.ResetPasswordRequest;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.PasswordResetToken;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.repository.PasswordResetTokenRepository;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Issue#6: パスワードリセット機能 - パスワード再設定API テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * API要件:
 * - POST /api/v1/auth/reset-password
 * - リクエストボディ: { "token": "...", "newPassword": "...", "confirmPassword": "..." }
 * - トークンの有効性検証（存在確認、期限確認）
 * - パスワードの一致確認
 * - パスワードルールの検証（新規登録時と同じ）
 * - パスワードのハッシュ化と更新
 * - トークンの無効化
 * - 200 OK と成功メッセージを返す
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class ResetPasswordTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User testUser;
    private PasswordResetToken validToken;

    @BeforeEach
    void setUp() {
        passwordResetTokenRepository.deleteAll();
        userRepository.deleteAll();

        // テストユーザーを作成
        testUser = new User();
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash("old-hashed-password");
        testUser.setRole("USER");
        testUser = userRepository.save(testUser);

        // 有効なトークンを作成
        validToken = new PasswordResetToken();
        validToken.setUserId(testUser.getId());
        validToken.setToken("valid-reset-token");
        validToken.setExpiryDate(new Date(System.currentTimeMillis() + 1800000)); // 30分後
        validToken = passwordResetTokenRepository.save(validToken);
    }

    @Test
    @DisplayName("正常なパスワード再設定 - 200 OK と成功メッセージを返す")
    void testResetPassword_ValidRequest_ReturnsOk() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", is("パスワードが正常に再設定されました")));
    }

    @Test
    @DisplayName("パスワードがハッシュ化されてDBに保存される")
    void testResetPassword_ValidRequest_UpdatesPasswordHash() throws Exception {
        String oldPasswordHash = testUser.getPasswordHash();

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // パスワードが更新されていることを確認
        User updatedUser = userRepository.findById(testUser.getId()).orElse(null);
        assertNotNull(updatedUser);
        assertNotEquals(oldPasswordHash, updatedUser.getPasswordHash(), "パスワードハッシュが更新されている");
        assertTrue(passwordEncoder.matches("NewPassword123", updatedUser.getPasswordHash()),
                "新しいパスワードが正しくハッシュ化されて保存されている");
    }

    @Test
    @DisplayName("パスワード再設定後、トークンが無効化される")
    void testResetPassword_ValidRequest_InvalidatesToken() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // トークンが削除されているか、無効化されていることを確認
        PasswordResetToken token = passwordResetTokenRepository.findByToken("valid-reset-token").orElse(null);
        assertNull(token, "トークンが削除または無効化されている");
    }

    @Test
    @DisplayName("エラー - トークンが存在しない")
    void testResetPassword_NonExistentToken_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("non-existent-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("トークンが無効または期限切れです")));
    }

    @Test
    @DisplayName("エラー - トークンが期限切れ")
    void testResetPassword_ExpiredToken_ReturnsBadRequest() throws Exception {
        // 期限切れのトークンを作成
        PasswordResetToken expiredToken = new PasswordResetToken();
        expiredToken.setUserId(testUser.getId());
        expiredToken.setToken("expired-token");
        expiredToken.setExpiryDate(new Date(System.currentTimeMillis() - 1000)); // 1秒前（期限切れ）
        passwordResetTokenRepository.save(expiredToken);

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("expired-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("トークンが無効または期限切れです")));
    }

    @Test
    @DisplayName("バリデーションエラー - token必須")
    void testResetPassword_MissingToken_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("token")));
    }

    @Test
    @DisplayName("バリデーションエラー - newPassword必須")
    void testResetPassword_MissingNewPassword_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setConfirmPassword("NewPassword123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("newPassword")));
    }

    @Test
    @DisplayName("バリデーションエラー - confirmPassword必須")
    void testResetPassword_MissingConfirmPassword_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("confirmPassword")));
    }

    @Test
    @DisplayName("エラー - パスワードが一致しない")
    void testResetPassword_PasswordMismatch_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("DifferentPassword123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("パスワードが一致しません")));
    }

    @Test
    @DisplayName("バリデーションエラー - パスワード文字数制限（8文字未満）")
    void testResetPassword_PasswordTooShort_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("Pass1"); // 5文字
        request.setConfirmPassword("Pass1");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("newPassword")));
    }

    @Test
    @DisplayName("バリデーションエラー - パスワード複雑さ要件（大文字なし）")
    void testResetPassword_PasswordWithoutUppercase_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("password123"); // 大文字なし
        request.setConfirmPassword("password123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("newPassword")));
    }

    @Test
    @DisplayName("バリデーションエラー - パスワード複雑さ要件（小文字なし）")
    void testResetPassword_PasswordWithoutLowercase_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("PASSWORD123"); // 小文字なし
        request.setConfirmPassword("PASSWORD123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("newPassword")));
    }

    @Test
    @DisplayName("バリデーションエラー - パスワード複雑さ要件（数字なし）")
    void testResetPassword_PasswordWithoutNumber_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("PasswordOnly"); // 数字なし
        request.setConfirmPassword("PasswordOnly");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("newPassword")));
    }

    @Test
    @DisplayName("同じトークンで2回パスワード再設定できない")
    void testResetPassword_TokenCannotBeReused() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        // 1回目のパスワード再設定
        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // 2回目のパスワード再設定（同じトークン）
        ResetPasswordRequest secondRequest = new ResetPasswordRequest();
        secondRequest.setToken("valid-reset-token");
        secondRequest.setNewPassword("AnotherPassword456");
        secondRequest.setConfirmPassword("AnotherPassword456");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(secondRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("トークンが無効または期限切れです")));
    }

    @Test
    @DisplayName("パスワード再設定後、古いパスワードではログインできない")
    void testResetPassword_OldPasswordNoLongerWorks() throws Exception {
        // 古いパスワードを保存
        String oldPassword = "OldPassword123";
        testUser.setPasswordHash(passwordEncoder.encode(oldPassword));
        userRepository.save(testUser);

        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-reset-token");
        request.setNewPassword("NewPassword123");
        request.setConfirmPassword("NewPassword123");

        mockMvc.perform(post("/api/v1/auth/reset-password")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // パスワードが更新されたことを確認
        User updatedUser = userRepository.findById(testUser.getId()).orElse(null);
        assertNotNull(updatedUser);
        assertFalse(passwordEncoder.matches(oldPassword, updatedUser.getPasswordHash()),
                "古いパスワードでは認証できない");
        assertTrue(passwordEncoder.matches("NewPassword123", updatedUser.getPasswordHash()),
                "新しいパスワードで認証できる");
    }
}
