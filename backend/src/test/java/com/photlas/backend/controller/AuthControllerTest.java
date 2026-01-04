package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.entity.User;
import com.photlas.backend.filter.RateLimitFilter;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureWebMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.hasSize;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        // Issue#23: レート制限キャッシュをクリアしてテスト間の干渉を防ぐ
        rateLimitFilter.clearCache();
    }

    @Test
    @DisplayName("正常なユーザー登録 - 201 Created とユーザー情報、JWTトークンを返す")
    void testRegisterUser_ValidRequest_ReturnsCreatedWithUserAndToken() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("testuser");
        request.setEmail("test@example.com");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.username", is("testuser")))
                .andExpect(jsonPath("$.user.email", is("test@example.com")))
                .andExpect(jsonPath("$.user.role", is("USER")))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.token").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - username必須")
    void testRegisterUser_MissingUsername_ReturnsBadRequest() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setEmail("test@example.com");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("username")))
                .andExpect(jsonPath("$.errors[0].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - username文字数制限")
    void testRegisterUser_InvalidUsernameLength_ReturnsBadRequest() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("a"); // 1文字（2文字未満）
        request.setEmail("test@example.com");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("username")));
    }

    @Test
    @DisplayName("バリデーションエラー - email必須")
    void testRegisterUser_MissingEmail_ReturnsBadRequest() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("testuser");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("email")));
    }

    @Test
    @DisplayName("バリデーションエラー - email形式不正")
    void testRegisterUser_InvalidEmailFormat_ReturnsBadRequest() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("testuser");
        request.setEmail("invalid-email");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("email")));
    }

    @Test
    @DisplayName("バリデーションエラー - email重複")
    void testRegisterUser_DuplicateEmail_ReturnsBadRequest() throws Exception {
        User existingUser = new User();
        existingUser.setUsername("existing");
        existingUser.setEmail("test@example.com");
        existingUser.setPasswordHash("hash");
        existingUser.setRole("USER");
        userRepository.save(existingUser);

        RegisterRequest request = new RegisterRequest();
        request.setUsername("testuser");
        request.setEmail("test@example.com");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("email")));
    }

    @Test
    @DisplayName("バリデーションエラー - password必須")
    void testRegisterUser_MissingPassword_ReturnsBadRequest() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("testuser");
        request.setEmail("test@example.com");

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("password")));
    }

    @Test
    @DisplayName("バリデーションエラー - password文字数制限")
    void testRegisterUser_InvalidPasswordLength_ReturnsBadRequest() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("testuser");
        request.setEmail("test@example.com");
        request.setPassword("Pass1"); // 5文字（8文字未満）

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("password")));
    }

    @Test
    @DisplayName("バリデーションエラー - password複雑さ要件")
    void testRegisterUser_InvalidPasswordComplexity_ReturnsBadRequest() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("testuser");
        request.setEmail("test@example.com");
        request.setPassword("password"); // 英小文字のみ

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("password")));
    }

    // Issue#21: パスワードバリデーション統一 - 記号禁止チェック
    @Test
    @DisplayName("バリデーションエラー - password記号禁止")
    void testRegisterUser_PasswordWithSpecialCharacters_ReturnsBadRequest() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("testuser");
        request.setEmail("test@example.com");
        request.setPassword("Password123!"); // 記号を含む

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("password")));
    }

    // Issue#21: パスワードバリデーション統一 - 最大文字数チェック
    @Test
    @DisplayName("バリデーションエラー - password最大文字数超過")
    void testRegisterUser_PasswordTooLong_ReturnsBadRequest() throws Exception {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("testuser");
        request.setEmail("test@example.com");
        request.setPassword("Password1234567890123"); // 21文字

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(1)))
                .andExpect(jsonPath("$.errors[0].field", is("password")));
    }
}