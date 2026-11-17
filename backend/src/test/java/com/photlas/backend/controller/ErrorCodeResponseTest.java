package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.ResetPasswordRequest;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.ErrorCodes;
import com.photlas.backend.filter.RateLimitFilter;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#93: 画面に出るエラーがエラーコード付きで返ることを、実際のエンドポイントで確かめる。
 * フロントエンドは code から表示言語の文言を出す（Spec#93 2.3 方式 B）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class ErrorCodeResponseTest {

    private static final String AUTH = "/api/v1/auth";
    private static final String EMAIL = "error-code@example.com";
    private static final String PASSWORD = "Password123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    @Autowired
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        rateLimitFilter.clearCache();
    }

    private User saveUser(boolean emailVerified, LocalDateTime deletedAt) {
        User user = new User();
        user.setUsername("errcode");
        user.setEmail(EMAIL);
        user.setPasswordHash("hashedpassword");
        user.setRole(CodeConstants.ROLE_USER);
        user.setEmailVerified(emailVerified);
        user.setDeletedAt(deletedAt);
        return userRepository.save(user);
    }

    private String registerBody(String email) throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("newuser");
        request.setEmail(email);
        request.setPassword(PASSWORD);
        request.setAgreedToTerms(true);
        request.setAgreedToPrivacy(true);
        request.setAgeConfirmed(true);
        return objectMapper.writeValueAsString(request);
    }

    @Test
    @DisplayName("Issue#93 - 入力チェックエラーは VALIDATION_ERROR（フィールド別の errors も残る）")
    void validationError() throws Exception {
        mockMvc.perform(post(AUTH + "/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.VALIDATION_ERROR))
                .andExpect(jsonPath("$.errors").isArray());
    }

    @Test
    @DisplayName("Issue#93 - 登録済みのメールアドレスで新規登録すると EMAIL_ALREADY_IN_USE")
    void register_emailAlreadyInUse() throws Exception {
        saveUser(true, null);

        mockMvc.perform(post(AUTH + "/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(EMAIL)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCodes.EMAIL_ALREADY_IN_USE));
    }

    @Test
    @DisplayName("Issue#93 - 退会処理中のメールアドレスで新規登録すると EMAIL_PENDING_DELETION")
    void register_emailPendingDeletion() throws Exception {
        saveUser(true, LocalDateTime.now().minusDays(1));

        mockMvc.perform(post(AUTH + "/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(EMAIL)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value(ErrorCodes.EMAIL_PENDING_DELETION));
    }

    @Test
    @DisplayName("Issue#93 - メール認証のトークンが無効なら INVALID_TOKEN")
    void verifyEmail_invalidToken() throws Exception {
        mockMvc.perform(get(AUTH + "/verify-email").param("token", "no-such-token"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.INVALID_TOKEN));
    }

    @Test
    @DisplayName("Issue#93 - パスワード再設定のトークンが無効なら INVALID_TOKEN")
    void resetPassword_invalidToken() throws Exception {
        ResetPasswordRequest request = new ResetPasswordRequest("no-such-token", PASSWORD, PASSWORD);

        mockMvc.perform(post(AUTH + "/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.INVALID_TOKEN));
    }

    @Test
    @DisplayName("Issue#93 - メールアドレス変更確定のトークンが無効なら INVALID_TOKEN")
    void confirmEmailChange_invalidToken() throws Exception {
        mockMvc.perform(get(AUTH + "/confirm-email-change").param("token", "no-such-token"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.INVALID_TOKEN));
    }

    @Test
    @DisplayName("Issue#93 - アカウント連携確認のトークンが無効なら INVALID_TOKEN")
    void confirmLink_invalidToken() throws Exception {
        mockMvc.perform(post(AUTH + "/oauth2/confirm-link")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("token", "no-such-token"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.INVALID_TOKEN));
    }

    @Test
    @DisplayName("Issue#93 - 認証メール再送でメールアドレスが空なら EMAIL_REQUIRED")
    void resendVerification_emailRequired() throws Exception {
        mockMvc.perform(post(AUTH + "/resend-verification")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", ""))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.EMAIL_REQUIRED));
    }

    @Test
    @DisplayName("Issue#93 - コードの無い 400（SNS リンクの未対応プラットフォーム）は BAD_REQUEST と固定の文言で、内部の message を返さない")
    void uncodedBadRequest_returnsGenericMessage() throws Exception {
        User user = saveUser(true, null);
        String body = "{\"snsLinks\":[{\"platform\":9999,\"url\":\"https://example.com/u\"}]}";

        mockMvc.perform(put("/api/v1/users/me/sns-links")
                        .header("Authorization", "Bearer " + jwtService.generateToken(user.getEmail()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.BAD_REQUEST))
                .andExpect(jsonPath("$.message").value("リクエストが正しくありません"));
    }

    @Test
    @DisplayName("Issue#93 - 認証済みのメールアドレスに認証メールを再送すると EMAIL_ALREADY_VERIFIED")
    void resendVerification_alreadyVerified() throws Exception {
        saveUser(true, null);

        mockMvc.perform(post(AUTH + "/resend-verification")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", EMAIL))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.EMAIL_ALREADY_VERIFIED));
    }
}
