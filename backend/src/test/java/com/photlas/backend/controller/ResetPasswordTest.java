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

    // エンドポイント定数
    private static final String RESET_PASSWORD_ENDPOINT = "/api/v1/auth/reset-password";

    // トークン定数
    private static final String VALID_RESET_TOKEN = "valid-reset-token";
    private static final String EXPIRED_TOKEN = "expired-token";
    private static final String NON_EXISTENT_TOKEN = "non-existent-token";

    // パスワード定数
    private static final String NEW_PASSWORD_123 = "NewPassword123";
    private static final String PASSWORD_123_WITH_SYMBOL = "Password123!";
    private static final String SHORT_PASSWORD = "Pass1";
    private static final String PASSWORD_WITHOUT_UPPERCASE = "password123";
    private static final String PASSWORD_WITHOUT_LOWERCASE = "PASSWORD123";
    private static final String PASSWORD_WITHOUT_NUMBER = "PasswordOnly";
    private static final String TOO_LONG_PASSWORD = "Password1234567890123";
    private static final String DIFFERENT_PASSWORD_123 = "DifferentPassword123";
    private static final String OLD_PASSWORD_123 = "OldPassword123";
    private static final String ANOTHER_PASSWORD_456 = "AnotherPassword456";

    // ユーザー情報定数
    private static final String TEST_USERNAME = "testuser";
    private static final String TEST_EMAIL = "test@example.com";
    private static final String OLD_HASHED_PASSWORD = "old-hashed-password";
    private static final String USER_ROLE = "USER";

    // JSONPath定数
    private static final String JSON_PATH_MESSAGE = "$.message";
    private static final String JSON_PATH_ERRORS = "$.errors";
    private static final String JSON_PATH_ERRORS_FIELD = "$.errors[0].field";

    // メッセージ定数
    private static final String SUCCESS_MESSAGE = "パスワードが正常に再設定されました";
    private static final String INVALID_TOKEN_MESSAGE = "トークンが無効または期限切れです";
    private static final String PASSWORD_MISMATCH_MESSAGE = "パスワードが一致しません";

    // フィールド名定数
    private static final String FIELD_TOKEN = "token";
    private static final String FIELD_NEW_PASSWORD = "newPassword";
    private static final String FIELD_CONFIRM_PASSWORD = "confirmPassword";

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
        testUser.setUsername(TEST_USERNAME);
        testUser.setEmail(TEST_EMAIL);
        testUser.setPasswordHash(OLD_HASHED_PASSWORD);
        testUser.setRole(USER_ROLE);
        testUser = userRepository.save(testUser);

        // 有効なトークンを作成
        validToken = new PasswordResetToken();
        validToken.setUserId(testUser.getId());
        validToken.setToken(VALID_RESET_TOKEN);
        validToken.setExpiryDate(new Date(System.currentTimeMillis() + 1800000)); // 30分後
        validToken = passwordResetTokenRepository.save(validToken);
    }

    /**
     * ResetPasswordRequestオブジェクトを作成するヘルパーメソッド
     */
    private ResetPasswordRequest createResetPasswordRequest(String token, String newPassword, String confirmPassword) {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken(token);
        request.setNewPassword(newPassword);
        request.setConfirmPassword(confirmPassword);
        return request;
    }

    /**
     * 期限切れトークンを作成するヘルパーメソッド
     */
    private PasswordResetToken createExpiredToken(String tokenValue) {
        PasswordResetToken token = new PasswordResetToken();
        token.setUserId(testUser.getId());
        token.setToken(tokenValue);
        token.setExpiryDate(new Date(System.currentTimeMillis() - 1000));
        return passwordResetTokenRepository.save(token);
    }

    @Test
    @DisplayName("正常なパスワード再設定 - 200 OK と成功メッセージを返す")
    void testResetPassword_ValidRequest_ReturnsOk() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, NEW_PASSWORD_123, NEW_PASSWORD_123);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_MESSAGE, is(SUCCESS_MESSAGE)));
    }

    @Test
    @DisplayName("パスワードがハッシュ化されてDBに保存される")
    void testResetPassword_ValidRequest_UpdatesPasswordHash() throws Exception {
        String oldPasswordHash = testUser.getPasswordHash();

        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, NEW_PASSWORD_123, NEW_PASSWORD_123);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // パスワードが更新されていることを確認
        User updatedUser = userRepository.findById(testUser.getId()).orElse(null);
        assertNotNull(updatedUser);
        assertNotEquals(oldPasswordHash, updatedUser.getPasswordHash(), "パスワードハッシュが更新されている");
        assertTrue(passwordEncoder.matches(NEW_PASSWORD_123, updatedUser.getPasswordHash()),
                "新しいパスワードが正しくハッシュ化されて保存されている");
    }

    @Test
    @DisplayName("パスワード再設定後、トークンが無効化される")
    void testResetPassword_ValidRequest_InvalidatesToken() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, NEW_PASSWORD_123, NEW_PASSWORD_123);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // トークンが削除されているか、無効化されていることを確認
        PasswordResetToken token = passwordResetTokenRepository.findByToken(VALID_RESET_TOKEN).orElse(null);
        assertNull(token, "トークンが削除または無効化されている");
    }

    @Test
    @DisplayName("エラー - トークンが存在しない")
    void testResetPassword_NonExistentToken_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(NON_EXISTENT_TOKEN, NEW_PASSWORD_123, NEW_PASSWORD_123);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_MESSAGE, is(INVALID_TOKEN_MESSAGE)));
    }

    @Test
    @DisplayName("エラー - トークンが期限切れ")
    void testResetPassword_ExpiredToken_ReturnsBadRequest() throws Exception {
        // 期限切れのトークンを作成
        createExpiredToken(EXPIRED_TOKEN);

        ResetPasswordRequest request = createResetPasswordRequest(EXPIRED_TOKEN, NEW_PASSWORD_123, NEW_PASSWORD_123);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_MESSAGE, is(INVALID_TOKEN_MESSAGE)));
    }

    @Test
    @DisplayName("バリデーションエラー - token必須")
    void testResetPassword_MissingToken_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(null, NEW_PASSWORD_123, NEW_PASSWORD_123);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERRORS_FIELD, is(FIELD_TOKEN)));
    }

    @Test
    @DisplayName("バリデーションエラー - newPassword必須")
    void testResetPassword_MissingNewPassword_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, null, NEW_PASSWORD_123);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERRORS_FIELD, is(FIELD_NEW_PASSWORD)));
    }

    @Test
    @DisplayName("バリデーションエラー - confirmPassword必須")
    void testResetPassword_MissingConfirmPassword_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, NEW_PASSWORD_123, null);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERRORS_FIELD, is(FIELD_CONFIRM_PASSWORD)));
    }

    @Test
    @DisplayName("エラー - パスワードが一致しない")
    void testResetPassword_PasswordMismatch_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, NEW_PASSWORD_123, DIFFERENT_PASSWORD_123);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_MESSAGE, is(PASSWORD_MISMATCH_MESSAGE)));
    }

    @Test
    @DisplayName("バリデーションエラー - パスワード文字数制限（8文字未満）")
    void testResetPassword_PasswordTooShort_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, SHORT_PASSWORD, SHORT_PASSWORD);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERRORS_FIELD, is(FIELD_NEW_PASSWORD)));
    }

    @Test
    @DisplayName("バリデーションエラー - パスワード複雑さ要件（大文字なし）")
    void testResetPassword_PasswordWithoutUppercase_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, PASSWORD_WITHOUT_UPPERCASE, PASSWORD_WITHOUT_UPPERCASE);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERRORS_FIELD, is(FIELD_NEW_PASSWORD)));
    }

    @Test
    @DisplayName("バリデーションエラー - パスワード複雑さ要件（小文字なし）")
    void testResetPassword_PasswordWithoutLowercase_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, PASSWORD_WITHOUT_LOWERCASE, PASSWORD_WITHOUT_LOWERCASE);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERRORS_FIELD, is(FIELD_NEW_PASSWORD)));
    }

    @Test
    @DisplayName("バリデーションエラー - パスワード複雑さ要件（数字なし）")
    void testResetPassword_PasswordWithoutNumber_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, PASSWORD_WITHOUT_NUMBER, PASSWORD_WITHOUT_NUMBER);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERRORS_FIELD, is(FIELD_NEW_PASSWORD)));
    }

    // Issue#21: パスワードバリデーション統一 - 記号禁止チェック
    @Test
    @DisplayName("バリデーションエラー - パスワード記号禁止")
    void testResetPassword_PasswordWithSpecialCharacters_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, PASSWORD_123_WITH_SYMBOL, PASSWORD_123_WITH_SYMBOL);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERRORS_FIELD, is(FIELD_NEW_PASSWORD)));
    }

    // Issue#21: パスワードバリデーション統一 - 最大文字数チェック
    @Test
    @DisplayName("バリデーションエラー - パスワード最大文字数超過")
    void testResetPassword_PasswordTooLong_ReturnsBadRequest() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, TOO_LONG_PASSWORD, TOO_LONG_PASSWORD);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERRORS_FIELD, is(FIELD_NEW_PASSWORD)));
    }

    @Test
    @DisplayName("同じトークンで2回パスワード再設定できない")
    void testResetPassword_TokenCannotBeReused() throws Exception {
        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, NEW_PASSWORD_123, NEW_PASSWORD_123);

        // 1回目のパスワード再設定
        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // 2回目のパスワード再設定（同じトークン）
        ResetPasswordRequest secondRequest = createResetPasswordRequest(VALID_RESET_TOKEN, ANOTHER_PASSWORD_456, ANOTHER_PASSWORD_456);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(secondRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_MESSAGE, is(INVALID_TOKEN_MESSAGE)));
    }

    @Test
    @DisplayName("パスワード再設定後、古いパスワードではログインできない")
    void testResetPassword_OldPasswordNoLongerWorks() throws Exception {
        // 古いパスワードを保存
        testUser.setPasswordHash(passwordEncoder.encode(OLD_PASSWORD_123));
        userRepository.save(testUser);

        ResetPasswordRequest request = createResetPasswordRequest(VALID_RESET_TOKEN, NEW_PASSWORD_123, NEW_PASSWORD_123);

        mockMvc.perform(post(RESET_PASSWORD_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // パスワードが更新されたことを確認
        User updatedUser = userRepository.findById(testUser.getId()).orElse(null);
        assertNotNull(updatedUser);
        assertFalse(passwordEncoder.matches(OLD_PASSWORD_123, updatedUser.getPasswordHash()),
                "古いパスワードでは認証できない");
        assertTrue(passwordEncoder.matches(NEW_PASSWORD_123, updatedUser.getPasswordHash()),
                "新しいパスワードで認証できる");
    }
}
