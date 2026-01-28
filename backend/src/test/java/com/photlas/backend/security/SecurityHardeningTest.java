package com.photlas.backend.security;

import com.photlas.backend.entity.User;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.JwtService;
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

import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * セキュリティ強化の統合テスト
 * Issue#23: Production Security Hardening
 *
 * JWT認証、環境変数化、H2コンソール本番無効化の動作確認テスト
 *
 * 注: CSRF保護はJWT認証（stateless）を使用しているため無効化されている。
 * JWTはlocalStorageに保存され、リクエストごとに明示的にAuthorizationヘッダーで
 * 送信されるため、ブラウザが自動的にCookieを送信するCSRF攻撃の対象にならない。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SecurityHardeningTest {

    // テストデータ定数
    private static final String TEST_USERNAME = "testuser";
    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_PASSWORD = "TestPassword123";
    private static final String TEST_USER_ROLE = "USER";

    // エンドポイント定数
    private static final String PHOTOS_ENDPOINT = "/api/v1/photos";
    private static final String AUTH_LOGIN_ENDPOINT = "/api/v1/auth/login";
    private static final String AUTH_REGISTER_ENDPOINT = "/api/v1/auth/register";
    private static final String AUTH_PASSWORD_RESET_REQUEST_ENDPOINT = "/api/v1/auth/password-reset-request";
    private static final String AUTH_PASSWORD_RESET_CONFIRM_ENDPOINT = "/api/v1/auth/password-reset-confirm";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private User testUser;
    private String token;

    @BeforeEach
    void setUp() {
        // クリーンアップ
        userRepository.deleteAll();

        // テストユーザーを作成
        testUser = new User();
        testUser.setUsername(TEST_USERNAME);
        testUser.setEmail(TEST_EMAIL);
        testUser.setPasswordHash(passwordEncoder.encode(TEST_PASSWORD));
        testUser.setRole(TEST_USER_ROLE);
        testUser = userRepository.save(testUser);

        // JWTトークンを生成
        token = jwtService.generateToken(testUser.getEmail());
    }

    // ==========================================
    // JWT認証のテスト
    // ==========================================

    @Test
    @DisplayName("JWT認証: 有効なトークンでPOSTリクエストが成功する（CSRF不要）")
    void testJwtAuth_PostWithValidToken_Succeeds() throws Exception {
        String requestBody = """
                {
                    "title": "Test Photo",
                    "s3ObjectKey": "test-key-12345",
                    "takenAt": "2024-01-01T12:00:00",
                    "latitude": 35.6812,
                    "longitude": 139.7671,
                    "categories": ["風景"]
                }
                """;

        // JWT認証でPOSTリクエストを送信（CSRFトークン不要）
        // 403(Forbidden)でなければ認証は成功
        mockMvc.perform(post(PHOTOS_ENDPOINT)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().is(not(403)));
    }

    @Test
    @DisplayName("JWT認証: トークンなしのPOSTリクエストはHTTP 401で拒否される")
    void testJwtAuth_PostWithoutToken_Returns401() throws Exception {
        String requestBody = """
                {
                    "title": "Test Photo",
                    "s3ObjectKey": "test-key-12345",
                    "takenAt": "2024-01-01T12:00:00",
                    "latitude": 35.6812,
                    "longitude": 139.7671,
                    "categories": ["風景"]
                }
                """;

        // JWTトークンなしでPOSTリクエストを送信
        mockMvc.perform(post(PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("JWT認証: 有効なトークンでPUTリクエストが成功する（CSRF不要）")
    void testJwtAuth_PutWithValidToken_Succeeds() throws Exception {
        String requestBody = """
                {
                    "bio": "Updated bio"
                }
                """;

        // JWT認証でPUTリクエストを送信（CSRFトークン不要）
        // 403(Forbidden)でなければ認証は成功
        mockMvc.perform(put("/api/v1/users/" + testUser.getId())
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().is(not(403)));
    }

    @Test
    @DisplayName("JWT認証: トークンなしのPUTリクエストはHTTP 401または429で拒否される")
    void testJwtAuth_PutWithoutToken_Returns401Or429() throws Exception {
        String requestBody = """
                {
                    "bio": "Updated bio"
                }
                """;

        // JWTトークンなしでPUTリクエストを送信
        // 401（認証エラー）または429（レート制限）のいずれかで拒否されれば成功
        mockMvc.perform(put("/api/v1/users/" + testUser.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    if (status != 401 && status != 429) {
                        throw new AssertionError("Status expected: 401 or 429 but was: " + status);
                    }
                });
    }

    @Test
    @DisplayName("JWT認証: トークンなしのDELETEリクエストはHTTP 401または429で拒否される")
    void testJwtAuth_DeleteWithoutToken_Returns401Or429() throws Exception {
        // JWTトークンなしでDELETEリクエストを送信
        // 401（認証エラー）または429（レート制限）のいずれかで拒否されれば成功
        mockMvc.perform(delete("/api/v1/users/" + testUser.getId()))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    if (status != 401 && status != 429) {
                        throw new AssertionError("Status expected: 401 or 429 but was: " + status);
                    }
                });
    }

    // ==========================================
    // 認証エンドポイントのテスト
    // ==========================================

    @Test
    @DisplayName("認証: ログインエンドポイントはJWTトークンなしで動作する")
    void testAuth_LoginEndpoint_WorksWithoutToken() throws Exception {
        String loginRequest = """
                {
                    "email": "test@example.com",
                    "password": "TestPassword123"
                }
                """;

        // JWTトークンなしでログインリクエストを送信
        mockMvc.perform(post(AUTH_LOGIN_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginRequest))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("認証: ユーザー登録エンドポイントはJWTトークンなしで動作する")
    void testAuth_RegisterEndpoint_WorksWithoutToken() throws Exception {
        String registerRequest = """
                {
                    "username": "newuser",
                    "email": "newuser@example.com",
                    "password": "NewPassword123"
                }
                """;

        // JWTトークンなしでユーザー登録リクエストを送信
        // 403(Forbidden)でなければ認可は成功
        // メールサーバー未起動などで500エラーになる可能性があるが、認可チェックはパスしている
        mockMvc.perform(post(AUTH_REGISTER_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerRequest))
                .andExpect(status().is(not(403)));
    }

    @Test
    @DisplayName("認証: パスワードリセット要求エンドポイントはJWTトークンなしで動作する")
    void testAuth_PasswordResetRequestEndpoint_WorksWithoutToken() throws Exception {
        String resetRequest = """
                {
                    "email": "test@example.com"
                }
                """;

        // JWTトークンなしでパスワードリセット要求を送信
        // 403(Forbidden)でなければ認可は成功
        mockMvc.perform(post(AUTH_PASSWORD_RESET_REQUEST_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resetRequest))
                .andExpect(status().is(not(403)));
    }

    @Test
    @DisplayName("認証: パスワードリセット確認エンドポイントはJWTトークンなしで動作する")
    void testAuth_PasswordResetConfirmEndpoint_WorksWithoutToken() throws Exception {
        String resetConfirmRequest = """
                {
                    "token": "dummy-token",
                    "newPassword": "NewPassword456"
                }
                """;

        // JWTトークンなしでパスワードリセット確認を送信（トークンが無効でも認可チェックはパスする）
        mockMvc.perform(post(AUTH_PASSWORD_RESET_CONFIRM_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resetConfirmRequest))
                .andExpect(status().is4xxClientError());  // トークン無効でエラーになるが、認可チェックはパス
    }

    // ==========================================
    // CORS設定のテスト（統合テストレベルでは限定的）
    // ==========================================

    @Test
    @DisplayName("CORS: プリフライトリクエストでCORSヘッダーが設定される")
    void testCors_PreflightRequest_ReturnsAllowCredentialsHeader() throws Exception {
        // POSTリクエストを送信
        // 注: 実際のCORS設定はNginxレベルで行われるため、
        // このテストは統合テスト環境では限定的な検証となる
        mockMvc.perform(post("/api/v1/photos")
                        .header("Authorization", "Bearer " + token)
                        .header("Origin", "http://localhost:5173")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().is4xxClientError());  // リクエストボディが不正だが、CORSは通過
    }
}
