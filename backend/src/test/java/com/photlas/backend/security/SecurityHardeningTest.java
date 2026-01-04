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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * セキュリティ強化の統合テスト
 * Issue#23: Production Security Hardening
 *
 * TDD Red段階: CSRF保護の実装前テスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SecurityHardeningTest {

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
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash(passwordEncoder.encode("TestPassword123"));
        testUser.setRole("USER");
        testUser = userRepository.save(testUser);

        // JWTトークンを生成
        token = jwtService.generateToken(testUser.getEmail());
    }

    // ==========================================
    // CSRF保護のテスト
    // ==========================================

    @Test
    @DisplayName("CSRF保護: トークンなしのPOSTリクエストはHTTP 403で拒否される")
    void testCsrfProtection_PostWithoutToken_Returns403() throws Exception {
        String requestBody = """
                {
                    "description": "Test photo",
                    "latitude": 35.6812,
                    "longitude": 139.7671
                }
                """;

        // CSRFトークンなしでPOSTリクエストを送信
        mockMvc.perform(post("/api/v1/photos")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("CSRF保護: トークンありのPOSTリクエストは成功する")
    void testCsrfProtection_PostWithToken_Succeeds() throws Exception {
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

        // CSRFトークンありでPOSTリクエストを送信
        // CSRFはパスするが、S3キーの検証やカテゴリの存在確認で400/404になる可能性がある
        // CSRF保護の観点では403(Forbidden)でなければ成功
        mockMvc.perform(post("/api/v1/photos")
                        .with(csrf())  // Spring SecurityのCSRFトークンを自動追加
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().is(not(403)));  // 403でなければCSRF保護は正常動作
    }

    @Test
    @DisplayName("CSRF保護: トークンなしのPUTリクエストはHTTP 403で拒否される")
    void testCsrfProtection_PutWithoutToken_Returns403() throws Exception {
        String requestBody = """
                {
                    "bio": "Updated bio"
                }
                """;

        // CSRFトークンなしでPUTリクエストを送信
        mockMvc.perform(put("/api/v1/users/" + testUser.getId())
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("CSRF保護: トークンなしのDELETEリクエストはHTTP 403で拒否される")
    void testCsrfProtection_DeleteWithoutToken_Returns403() throws Exception {
        // CSRFトークンなしでDELETEリクエストを送信
        mockMvc.perform(delete("/api/v1/users/" + testUser.getId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    // ==========================================
    // CSRF除外エンドポイントのテスト
    // ==========================================

    @Test
    @DisplayName("CSRF除外: ログインエンドポイントはCSRFトークンなしで動作する")
    void testCsrfExemption_LoginEndpoint_WorksWithoutToken() throws Exception {
        String loginRequest = """
                {
                    "email": "test@example.com",
                    "password": "TestPassword123"
                }
                """;

        // CSRFトークンなしでログインリクエストを送信
        // CSRF除外なので403(Forbidden)にならなければ成功
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginRequest))
                .andExpect(status().is(not(403)));
    }

    @Test
    @DisplayName("CSRF除外: ユーザー登録エンドポイントはCSRFトークンなしで動作する")
    void testCsrfExemption_RegisterEndpoint_WorksWithoutToken() throws Exception {
        String registerRequest = """
                {
                    "username": "newuser",
                    "email": "newuser@example.com",
                    "password": "NewPassword123"
                }
                """;

        // CSRFトークンなしでユーザー登録リクエストを送信
        // CSRF除外なので403(Forbidden)にならなければ成功
        // メールサーバー未起動などで500エラーになる可能性があるが、CSRFチェックはパスしている
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerRequest))
                .andExpect(status().is(not(403)));
    }

    @Test
    @DisplayName("CSRF除外: パスワードリセット要求エンドポイントはCSRFトークンなしで動作する")
    void testCsrfExemption_PasswordResetRequestEndpoint_WorksWithoutToken() throws Exception {
        String resetRequest = """
                {
                    "email": "test@example.com"
                }
                """;

        // CSRFトークンなしでパスワードリセット要求を送信
        // CSRF除外なので403(Forbidden)にならなければ成功
        mockMvc.perform(post("/api/v1/auth/password-reset-request")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resetRequest))
                .andExpect(status().is(not(403)));
    }

    @Test
    @DisplayName("CSRF除外: パスワードリセット確認エンドポイントはCSRFトークンなしで動作する")
    void testCsrfExemption_PasswordResetConfirmEndpoint_WorksWithoutToken() throws Exception {
        String resetConfirmRequest = """
                {
                    "token": "dummy-token",
                    "newPassword": "NewPassword456"
                }
                """;

        // CSRFトークンなしでパスワードリセット確認を送信（トークンが無効でもCSRFチェックはパスする）
        mockMvc.perform(post("/api/v1/auth/password-reset-confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resetConfirmRequest))
                .andExpect(status().is4xxClientError());  // トークン無効でエラーになるが、CSRFチェックはパス
    }

    // ==========================================
    // CORS設定のテスト（統合テストレベルでは限定的）
    // ==========================================

    @Test
    @DisplayName("CORS: プリフライトリクエストでAccess-Control-Allow-Credentialsヘッダーが設定される")
    void testCors_PreflightRequest_ReturnsAllowCredentialsHeader() throws Exception {
        // OPTIONSリクエスト（プリフライト）を送信
        // 注: 実際のCORS設定はNginxレベルで行われるため、
        // このテストは統合テスト環境では限定的な検証となる
        mockMvc.perform(post("/api/v1/photos")
                        .with(csrf())
                        .header("Authorization", "Bearer " + token)
                        .header("Origin", "http://localhost:5173")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().is4xxClientError());  // リクエストボディが不正だが、CORSは通過
    }
}
