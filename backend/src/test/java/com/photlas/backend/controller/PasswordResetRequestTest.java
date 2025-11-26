package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.PasswordResetRequest;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Issue#6: パスワードリセット機能 - パスワードリセットリクエストAPI テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * API要件:
 * - POST /api/v1/auth/password-reset-request
 * - リクエストボディ: { "email": "user@example.com" }
 * - メールアドレスの存在確認
 * - パスワードリセットトークンの生成（有効期限30分）
 * - メール送信（Amazon SES経由）
 * - セキュリティ上、メールアドレスが存在しない場合でも同じレスポンスを返す
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class PasswordResetRequestTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @BeforeEach
    void setUp() {
        passwordResetTokenRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("正常なパスワードリセットリクエスト - 200 OK と成功メッセージを返す")
    void testPasswordResetRequest_ValidEmail_ReturnsOk() throws Exception {
        // 既存ユーザーを作成
        User user = new User();
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole("USER");
        userRepository.save(user);

        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("test@example.com");

        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", is("パスワードリセット用のメールを送信しました。メールをご確認ください。")));
    }

    @Test
    @DisplayName("パスワードリセットトークンがDBに保存される")
    void testPasswordResetRequest_ValidEmail_SavesTokenToDatabase() throws Exception {
        // 既存ユーザーを作成
        User user = new User();
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole("USER");
        userRepository.save(user);

        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("test@example.com");

        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // トークンがDBに保存されていることを確認
        PasswordResetToken savedToken = passwordResetTokenRepository.findByUserId(user.getId()).orElse(null);
        assertNotNull(savedToken, "パスワードリセットトークンがDBに保存されている");
        assertEquals(user.getId(), savedToken.getUserId(), "トークンが正しいユーザーに関連付けられている");
        assertNotNull(savedToken.getToken(), "トークンが生成されている");
        assertNotNull(savedToken.getExpiryDate(), "有効期限が設定されている");
    }

    @Test
    @DisplayName("トークンの有効期限が30分に設定される")
    void testPasswordResetRequest_ValidEmail_SetsExpiryTo30Minutes() throws Exception {
        // 既存ユーザーを作成
        User user = new User();
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole("USER");
        userRepository.save(user);

        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("test@example.com");

        long beforeRequest = System.currentTimeMillis();

        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        long afterRequest = System.currentTimeMillis();

        // トークンの有効期限を確認
        PasswordResetToken savedToken = passwordResetTokenRepository.findByUserId(user.getId()).orElse(null);
        assertNotNull(savedToken);

        long tokenExpiryTime = savedToken.getExpiryDate().getTime();
        long expectedMinExpiry = beforeRequest + (30 * 60 * 1000); // 30分後
        long expectedMaxExpiry = afterRequest + (30 * 60 * 1000);

        assertTrue(tokenExpiryTime >= expectedMinExpiry && tokenExpiryTime <= expectedMaxExpiry,
                "トークンの有効期限が30分に設定されている");
    }

    @Test
    @DisplayName("存在しないメールアドレスでも同じレスポンスを返す（セキュリティ）")
    void testPasswordResetRequest_NonExistentEmail_ReturnsSameResponse() throws Exception {
        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("nonexistent@example.com");

        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message", is("パスワードリセット用のメールを送信しました。メールをご確認ください。")));
    }

    @Test
    @DisplayName("存在しないメールアドレスの場合、トークンは保存されない")
    void testPasswordResetRequest_NonExistentEmail_DoesNotSaveToken() throws Exception {
        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("nonexistent@example.com");

        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // トークンが保存されていないことを確認
        assertEquals(0, passwordResetTokenRepository.count(), "存在しないメールアドレスの場合、トークンは保存されない");
    }

    @Test
    @DisplayName("バリデーションエラー - email必須")
    void testPasswordResetRequest_MissingEmail_ReturnsBadRequest() throws Exception {
        PasswordResetRequest request = new PasswordResetRequest();

        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("email")));
    }

    @Test
    @DisplayName("バリデーションエラー - email形式不正")
    void testPasswordResetRequest_InvalidEmailFormat_ReturnsBadRequest() throws Exception {
        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("invalid-email");

        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("email")));
    }

    @Test
    @DisplayName("既存のトークンがある場合、新しいトークンで上書きされる")
    void testPasswordResetRequest_ExistingToken_ReplacesWithNewToken() throws Exception {
        // 既存ユーザーを作成
        User user = new User();
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole("USER");
        user = userRepository.save(user);

        // 既存のトークンを作成
        PasswordResetToken oldToken = new PasswordResetToken();
        oldToken.setUserId(user.getId());
        oldToken.setToken("old-token");
        oldToken.setExpiryDate(new java.util.Date(System.currentTimeMillis() + 1800000));
        passwordResetTokenRepository.save(oldToken);

        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("test@example.com");

        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // 新しいトークンで上書きされていることを確認
        PasswordResetToken newToken = passwordResetTokenRepository.findByUserId(user.getId()).orElse(null);
        assertNotNull(newToken);
        assertNotEquals("old-token", newToken.getToken(), "新しいトークンが生成されている");
    }

    @Test
    @DisplayName("トークンは推測困難なランダム文字列である")
    void testPasswordResetRequest_GeneratesSecureRandomToken() throws Exception {
        // 既存ユーザーを作成
        User user = new User();
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPasswordHash("hashed-password");
        user.setRole("USER");
        userRepository.save(user);

        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("test@example.com");

        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // トークンの長さと形式を確認
        PasswordResetToken savedToken = passwordResetTokenRepository.findByUserId(user.getId()).orElse(null);
        assertNotNull(savedToken);
        assertTrue(savedToken.getToken().length() >= 32, "トークンは十分に長い（32文字以上）");
        assertTrue(savedToken.getToken().matches("^[a-zA-Z0-9\\-_]+$"), "トークンは英数字で構成されている");
    }
}
