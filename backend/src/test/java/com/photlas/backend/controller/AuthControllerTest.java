package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.entity.User;
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

    // テストデータ定数
    private static final String TEST_USERNAME = "testuser";
    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_PASSWORD = "Password123";
    private static final String EXISTING_USERNAME = "existing";
    private static final String EXISTING_PASSWORD_HASH = "hash";
    private static final String USER_ROLE = "USER";
    private static final String INVALID_EMAIL = "invalid-email";
    private static final String INVALID_PASSWORD_SHORT = "Pass1";
    private static final String INVALID_PASSWORD_WEAK = "password";
    private static final String INVALID_USERNAME_SHORT = "a";

    // エンドポイント定数
    private static final String REGISTER_ENDPOINT = "/api/v1/auth/register";

    // JSONPath定数
    private static final String JSON_PATH_USER_USERNAME = "$.user.username";
    private static final String JSON_PATH_USER_EMAIL = "$.user.email";
    private static final String JSON_PATH_USER_ROLE = "$.user.role";
    private static final String JSON_PATH_USER_PASSWORD_HASH = "$.user.passwordHash";
    private static final String JSON_PATH_TOKEN = "$.token";
    private static final String JSON_PATH_ERRORS = "$.errors";
    private static final String JSON_PATH_ERROR_FIELD = "$.errors[0].field";
    private static final String JSON_PATH_ERROR_MESSAGE = "$.errors[0].message";

    // フィールド名定数
    private static final String FIELD_USERNAME = "username";
    private static final String FIELD_EMAIL = "email";
    private static final String FIELD_PASSWORD = "password";

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    /**
     * RegisterRequestオブジェクトを生成するヘルパーメソッド
     */
    private RegisterRequest createRegisterRequest(String username, String email, String password) {
        RegisterRequest request = new RegisterRequest();
        request.setUsername(username);
        request.setEmail(email);
        request.setPassword(password);
        return request;
    }

    /**
     * 既存ユーザーを作成するヘルパーメソッド
     */
    private User createExistingUser(String username, String email) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(EXISTING_PASSWORD_HASH);
        user.setRole(USER_ROLE);
        return userRepository.save(user);
    }

    @Test
    @DisplayName("正常なユーザー登録 - 201 Created とユーザー情報、JWTトークンを返す")
    void testRegisterUser_ValidRequest_ReturnsCreatedWithUserAndToken() throws Exception {
        RegisterRequest request = createRegisterRequest(TEST_USERNAME, TEST_EMAIL, TEST_PASSWORD);

        mockMvc.perform(post(REGISTER_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath(JSON_PATH_USER_USERNAME, is(TEST_USERNAME)))
                .andExpect(jsonPath(JSON_PATH_USER_EMAIL, is(TEST_EMAIL)))
                .andExpect(jsonPath(JSON_PATH_USER_ROLE, is(USER_ROLE)))
                .andExpect(jsonPath(JSON_PATH_USER_PASSWORD_HASH).doesNotExist())
                .andExpect(jsonPath(JSON_PATH_TOKEN).exists());
    }

    @Test
    @DisplayName("バリデーションエラー - username必須")
    void testRegisterUser_MissingUsername_ReturnsBadRequest() throws Exception {
        RegisterRequest request = createRegisterRequest(null, TEST_EMAIL, TEST_PASSWORD);

        mockMvc.perform(post(REGISTER_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERROR_FIELD, is(FIELD_USERNAME)))
                .andExpect(jsonPath(JSON_PATH_ERROR_MESSAGE).exists());
    }

    @Test
    @DisplayName("バリデーションエラー - username文字数制限")
    void testRegisterUser_InvalidUsernameLength_ReturnsBadRequest() throws Exception {
        RegisterRequest request = createRegisterRequest(INVALID_USERNAME_SHORT, TEST_EMAIL, TEST_PASSWORD);

        mockMvc.perform(post(REGISTER_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERROR_FIELD, is(FIELD_USERNAME)));
    }

    @Test
    @DisplayName("バリデーションエラー - email必須")
    void testRegisterUser_MissingEmail_ReturnsBadRequest() throws Exception {
        RegisterRequest request = createRegisterRequest(TEST_USERNAME, null, TEST_PASSWORD);

        mockMvc.perform(post(REGISTER_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERROR_FIELD, is(FIELD_EMAIL)));
    }

    @Test
    @DisplayName("バリデーションエラー - email形式不正")
    void testRegisterUser_InvalidEmailFormat_ReturnsBadRequest() throws Exception {
        RegisterRequest request = createRegisterRequest(TEST_USERNAME, INVALID_EMAIL, TEST_PASSWORD);

        mockMvc.perform(post(REGISTER_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERROR_FIELD, is(FIELD_EMAIL)));
    }

    @Test
    @DisplayName("バリデーションエラー - email重複")
    void testRegisterUser_DuplicateEmail_ReturnsBadRequest() throws Exception {
        createExistingUser(EXISTING_USERNAME, TEST_EMAIL);

        RegisterRequest request = createRegisterRequest(TEST_USERNAME, TEST_EMAIL, TEST_PASSWORD);

        mockMvc.perform(post(REGISTER_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERROR_FIELD, is(FIELD_EMAIL)));
    }

    @Test
    @DisplayName("バリデーションエラー - password必須")
    void testRegisterUser_MissingPassword_ReturnsBadRequest() throws Exception {
        RegisterRequest request = createRegisterRequest(TEST_USERNAME, TEST_EMAIL, null);

        mockMvc.perform(post(REGISTER_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERROR_FIELD, is(FIELD_PASSWORD)));
    }

    @Test
    @DisplayName("バリデーションエラー - password文字数制限")
    void testRegisterUser_InvalidPasswordLength_ReturnsBadRequest() throws Exception {
        RegisterRequest request = createRegisterRequest(TEST_USERNAME, TEST_EMAIL, INVALID_PASSWORD_SHORT);

        mockMvc.perform(post(REGISTER_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERROR_FIELD, is(FIELD_PASSWORD)));
    }

    @Test
    @DisplayName("バリデーションエラー - password複雑さ要件")
    void testRegisterUser_InvalidPasswordComplexity_ReturnsBadRequest() throws Exception {
        RegisterRequest request = createRegisterRequest(TEST_USERNAME, TEST_EMAIL, INVALID_PASSWORD_WEAK);

        mockMvc.perform(post(REGISTER_ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_ERROR_FIELD, is(FIELD_PASSWORD)));
    }
}
