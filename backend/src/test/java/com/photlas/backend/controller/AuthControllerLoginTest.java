package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.LoginRequest;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.entity.User;
import com.photlas.backend.filter.RateLimitFilter;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.is;

/**
 * Issue#5: ログイン・ログアウト機能 - ログインAPI テスト
 * TDD Red段階: 実装前のテストケース定義
 *
 * 対象エンドポイント: POST /api/v1/auth/login
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AuthControllerLoginTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    private User testUser;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        rateLimitFilter.clearCache();

        // テスト用ユーザーを作成（メール認証済み）
        testUser = new User();
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash(passwordEncoder.encode("Password123"));
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser.setEmailVerified(true);
        userRepository.save(testUser);
    }

    @Test
    @DisplayName("正常なログイン - 200 OK と JWT トークンを返す")
    void testLogin_ValidCredentials_ReturnsOkWithToken() throws Exception {
        // Red段階: LoginRequest DTOが存在しないため失敗
        LoginRequest request = new LoginRequest();
        request.setEmail("test@example.com");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username", is("testuser")))
                .andExpect(jsonPath("$.user.email", is("test@example.com")))
                .andExpect(jsonPath("$.user.role", is(CodeConstants.ROLE_USER)))
                .andExpect(jsonPath("$.user.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.token").exists());
    }

    @Test
    @DisplayName("無効なメールアドレス - 401 Unauthorized")
    void testLogin_InvalidEmail_ReturnsUnauthorized() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("nonexistent@example.com");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", is("メールアドレスまたはパスワードが正しくありません")));
    }

    @Test
    @DisplayName("無効なパスワード - 401 Unauthorized")
    void testLogin_InvalidPassword_ReturnsUnauthorized() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("test@example.com");
        request.setPassword("WrongPassword");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", is("メールアドレスまたはパスワードが正しくありません")));
    }

    @Test
    @DisplayName("バリデーションエラー - email必須")
    void testLogin_MissingEmail_ReturnsBadRequest() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field", is("email")))
                .andExpect(jsonPath("$.errors[0].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - password必須")
    void testLogin_MissingPassword_ReturnsBadRequest() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("test@example.com");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field", is("password")))
                .andExpect(jsonPath("$.errors[0].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - email形式不正")
    void testLogin_InvalidEmailFormat_ReturnsBadRequest() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("invalid-email");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field", is("email")))
                .andExpect(jsonPath("$.errors[0].message").exists());
    }

    @Test
    @DisplayName("空のリクエストボディ - 400 Bad Request")
    void testLogin_EmptyBody_ReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("バリデーションエラー - email空文字")
    void testLogin_EmptyEmail_ReturnsBadRequest() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field", is("email")))
                .andExpect(jsonPath("$.errors[0].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - password空文字")
    void testLogin_EmptyPassword_ReturnsBadRequest() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("test@example.com");
        request.setPassword("");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field", is("password")))
                .andExpect(jsonPath("$.errors[0].message").exists());
    }

    @Test
    @DisplayName("ログインで取得したJWTトークンが認証済みエンドポイントで使用できる")
    void testLogin_ReturnedToken_CanBeUsedForAuthenticatedEndpoints() throws Exception {
        LoginRequest request = new LoginRequest();
        request.setEmail("test@example.com");
        request.setPassword("Password123");

        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").exists())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        String token = new com.fasterxml.jackson.databind.ObjectMapper()
                .readTree(responseBody).get("token").asText();

        // 取得したトークンで認証済みエンドポイントにアクセスできる
        mockMvc.perform(get("/api/v1/users/me")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email", is("test@example.com")));
    }

    // ===== Issue#91: ログイン時の言語設定更新 =====

    @Test
    @DisplayName("Issue#91 - ログイン: Accept-Language が en の場合、language が en に更新される")
    void testLogin_AcceptLanguageEn_UpdatesLanguageToEn() throws Exception {
        // ユーザーの初期言語は ja
        assertThat(testUser.getLanguage()).isEqualTo("ja");

        LoginRequest request = new LoginRequest();
        request.setEmail("test@example.com");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/login")
                .header("Accept-Language", "en-US,en;q=0.9")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        User updatedUser = userRepository.findByEmail("test@example.com").orElseThrow();
        assertThat(updatedUser.getLanguage()).isEqualTo("en");
    }

    // ===== Issue#92: アカウント復旧機能 =====

    @Test
    @DisplayName("Issue#92 - ソフトデリート済みユーザーが正しいパスワードでログイン → アカウント復旧、200 OK")
    void testLogin_SoftDeletedUser_CorrectPassword_RestoresAccountAndReturnsOk() throws Exception {
        // Given: ソフトデリート済みユーザー
        User deletedUser = new User();
        deletedUser.setUsername("d_abcdef1234");
        deletedUser.setEmail("deleted@example.com");
        deletedUser.setPasswordHash(passwordEncoder.encode("Password123"));
        deletedUser.setRole(CodeConstants.ROLE_USER);
        deletedUser.setEmailVerified(true);
        deletedUser.setDeletedAt(LocalDateTime.now().minusDays(5));
        deletedUser.setOriginalUsername("deleteduser");
        userRepository.save(deletedUser);

        // When: 正しいパスワードでログイン
        LoginRequest request = new LoginRequest();
        request.setEmail("deleted@example.com");
        request.setPassword("Password123");

        // Then: 200 OK、ユーザー名が復元され、JWTトークンが返る
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.username", is("deleteduser")))
                .andExpect(jsonPath("$.token").exists());
    }

    @Test
    @DisplayName("Issue#92 - ソフトデリート済みユーザーの復旧後、全フィールドが正しくリストアされる")
    void testLogin_SoftDeletedUser_CorrectPassword_RestoresUserFields() throws Exception {
        // Given: ソフトデリート済みユーザー（deletionHoldUntil設定あり）
        User deletedUser = new User();
        deletedUser.setUsername("d_abcdef1234");
        deletedUser.setEmail("deleted@example.com");
        deletedUser.setPasswordHash(passwordEncoder.encode("Password123"));
        deletedUser.setRole(CodeConstants.ROLE_USER);
        deletedUser.setEmailVerified(true);
        deletedUser.setDeletedAt(LocalDateTime.now().minusDays(5));
        deletedUser.setOriginalUsername("myoriginal");
        deletedUser.setDeletionHoldUntil(LocalDateTime.now().plusDays(120));
        userRepository.save(deletedUser);

        // When: 正しいパスワードでログイン
        LoginRequest request = new LoginRequest();
        request.setEmail("deleted@example.com");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // Then: フィールドが正しく復元されている
        User restored = userRepository.findByEmail("deleted@example.com").orElseThrow();
        assertThat(restored.getDeletedAt()).isNull();
        assertThat(restored.getUsername()).isEqualTo("myoriginal");
        assertThat(restored.getOriginalUsername()).isNull();
        assertThat(restored.getDeletionHoldUntil()).isNull();
    }

    @Test
    @DisplayName("Issue#92 - ソフトデリート済みユーザーが誤ったパスワードでログイン → 復旧されず認証エラー")
    void testLogin_SoftDeletedUser_WrongPassword_DoesNotRestoreAccount() throws Exception {
        // Given: ソフトデリート済みユーザー
        User deletedUser = new User();
        deletedUser.setUsername("d_abcdef1234");
        deletedUser.setEmail("deleted@example.com");
        deletedUser.setPasswordHash(passwordEncoder.encode("Password123"));
        deletedUser.setRole(CodeConstants.ROLE_USER);
        deletedUser.setEmailVerified(true);
        deletedUser.setDeletedAt(LocalDateTime.now().minusDays(5));
        deletedUser.setOriginalUsername("deleteduser");
        userRepository.save(deletedUser);

        // When: 誤ったパスワードでログイン
        LoginRequest request = new LoginRequest();
        request.setEmail("deleted@example.com");
        request.setPassword("WrongPassword1");

        // Then: 401 Unauthorized
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", is("メールアドレスまたはパスワードが正しくありません")));

        // ユーザーは復旧されていない
        User stillDeleted = userRepository.findByEmail("deleted@example.com").orElseThrow();
        assertThat(stillDeleted.getDeletedAt()).isNotNull();
        assertThat(stillDeleted.getOriginalUsername()).isEqualTo("deleteduser");
    }

    @Test
    @DisplayName("Issue#92 - 停止済み＋ソフトデリート済みユーザーが正しいパスワードでログイン → 復旧されるが停止エラー")
    void testLogin_SuspendedAndSoftDeletedUser_CorrectPassword_RestoresButReturnsSuspended() throws Exception {
        // Given: 停止済み＋ソフトデリート済みユーザー
        User deletedUser = new User();
        deletedUser.setUsername("d_abcdef1234");
        deletedUser.setEmail("suspended-deleted@example.com");
        deletedUser.setPasswordHash(passwordEncoder.encode("Password123"));
        deletedUser.setRole(CodeConstants.ROLE_SUSPENDED);
        deletedUser.setEmailVerified(true);
        deletedUser.setDeletedAt(LocalDateTime.now().minusDays(5));
        deletedUser.setOriginalUsername("suspuser");
        userRepository.save(deletedUser);

        // When: 正しいパスワードでログイン
        LoginRequest request = new LoginRequest();
        request.setEmail("suspended-deleted@example.com");
        request.setPassword("Password123");

        // Then: 403 停止エラー
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", is("アカウントが停止されています")));

        // アカウントは復旧されている
        User restored = userRepository.findByEmail("suspended-deleted@example.com").orElseThrow();
        assertThat(restored.getDeletedAt()).isNull();
        assertThat(restored.getUsername()).isEqualTo("suspuser");
        assertThat(restored.getOriginalUsername()).isNull();
    }

    @Test
    @DisplayName("メール未認証ユーザーのログイン - 403 Forbidden")
    void testLogin_EmailNotVerified_ReturnsForbidden() throws Exception {
        // メール未認証のユーザーを作成
        User unverifiedUser = new User();
        unverifiedUser.setUsername("unverified");
        unverifiedUser.setEmail("unverified@example.com");
        unverifiedUser.setPasswordHash(passwordEncoder.encode("Password123"));
        unverifiedUser.setRole(CodeConstants.ROLE_USER);
        unverifiedUser.setEmailVerified(false);
        userRepository.save(unverifiedUser);

        LoginRequest request = new LoginRequest();
        request.setEmail("unverified@example.com");
        request.setPassword("Password123");

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message", is("メールアドレスが認証されていません。認証メール内のリンクをクリックしてください。")));
    }
}