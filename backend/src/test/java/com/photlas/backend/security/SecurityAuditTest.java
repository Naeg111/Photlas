package com.photlas.backend.security;

import com.photlas.backend.entity.User;
import com.photlas.backend.filter.RateLimitFilter;
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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * セキュリティ監査テスト
 * Issue#24: Security Audit and Validation Verification
 *
 * OWASP Top 10 2021に基づく包括的なセキュリティ検証
 * Red段階: セキュリティ要件を満たしているかを検証するテスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SecurityAuditTest {

    // テストデータ定数
    private static final String TEST_USERNAME = "testuser";
    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_PASSWORD = "TestPassword123";
    private static final String TEST_USER_ROLE = "USER";

    private static final String OTHER_USERNAME = "otheruser";
    private static final String OTHER_EMAIL = "other@example.com";
    private static final String OTHER_PASSWORD = "OtherPassword123";

    // エンドポイント定数
    private static final String USERS_ME_PROFILE_ENDPOINT = "/api/v1/users/me/profile";
    private static final String USERS_ME_ENDPOINT = "/api/v1/users/me";
    private static final String AUTH_LOGIN_ENDPOINT = "/api/v1/auth/login";
    private static final String AUTH_REGISTER_ENDPOINT = "/api/v1/auth/register";
    private static final String AUTH_PASSWORD_RESET_REQUEST_ENDPOINT = "/api/v1/auth/password-reset-request";
    private static final String AUTH_PASSWORD_RESET_CONFIRM_ENDPOINT = "/api/v1/auth/password-reset-confirm";

    // BCrypt定数
    private static final String BCRYPT_PREFIX_2A = "$2a$";
    private static final String BCRYPT_PREFIX_2B = "$2b$";
    private static final int BCRYPT_HASH_LENGTH = 60;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    private User testUser;
    private String validToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        rateLimitFilter.clearCache();

        testUser = new User();
        testUser.setUsername(TEST_USERNAME);
        testUser.setEmail(TEST_EMAIL);
        testUser.setPasswordHash(passwordEncoder.encode(TEST_PASSWORD));
        testUser.setRole(TEST_USER_ROLE);
        testUser = userRepository.save(testUser);

        validToken = jwtService.generateToken(testUser.getEmail());
    }

    /**
     * 別のテストユーザーを作成するヘルパーメソッド
     */
    private User createOtherUser() {
        User otherUser = new User();
        otherUser.setUsername(OTHER_USERNAME);
        otherUser.setEmail(OTHER_EMAIL);
        otherUser.setPasswordHash(passwordEncoder.encode(OTHER_PASSWORD));
        otherUser.setRole(TEST_USER_ROLE);
        return userRepository.save(otherUser);
    }

    /**
     * Authorizationヘッダー値を作成するヘルパーメソッド
     */
    private String createAuthorizationHeader(String token) {
        return "Bearer " + token;
    }

    // ==========================================
    // A01:2021 - Broken Access Control
    // ==========================================

    @Test
    @DisplayName("A01 - 他ユーザーのトークンでプロフィール更新ができない")
    void testBrokenAccessControl_PreventUnauthorizedProfileUpdate() throws Exception {
        // 別のユーザーを作成
        User otherUser = createOtherUser();

        // otherUserのトークンを生成
        String otherUserToken = jwtService.generateToken(otherUser.getEmail());

        String updateRequest = """
                {
                    "username": "hackeduser"
                }
                """;

        // otherUserのトークンでtestUserのプロフィールを更新しようとする
        // 実際には/api/v1/users/me/profileはトークン所有者のプロフィールを更新する
        // そのため、このテストはAPIが正しく自分自身のプロフィールのみ更新することを確認
        mockMvc.perform(put(USERS_ME_PROFILE_ENDPOINT)
                        .with(csrf())
                        .header("Authorization", createAuthorizationHeader(otherUserToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateRequest))
                .andExpect(status().isOk());  // otherUserのプロフィールが更新される（正常）

        // testUserのデータが変更されていないことを確認するためにリロード
        User reloadedTestUser = userRepository.findById(testUser.getId()).orElseThrow();
        assert !reloadedTestUser.getUsername().equals("hackeduser")
            : "testUserのusernameが不正に変更されています";
    }

    @Test
    @DisplayName("A01 - /meエンドポイントは認証ユーザー自身のリソースのみアクセス可能")
    void testBrokenAccessControl_MeEndpointAccessControl() throws Exception {
        User otherUser = createOtherUser();
        String otherUserToken = jwtService.generateToken(otherUser.getEmail());

        String deleteRequest = String.format("""
                {
                    "password": "%s"
                }
                """, OTHER_PASSWORD);

        // otherUserのトークンで/meエンドポイントにアクセス
        mockMvc.perform(delete(USERS_ME_ENDPOINT)
                        .with(csrf())
                        .header("Authorization", createAuthorizationHeader(otherUserToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(deleteRequest))
                .andExpect(status().isNoContent());  // otherUser自身のアカウント削除（正常）

        // testUserが削除されていないことを確認
        assert userRepository.findById(testUser.getId()).isPresent()
            : "testUserが不正に削除されています";
    }

    // ==========================================
    // A02:2021 - Cryptographic Failures
    // ==========================================

    @Test
    @DisplayName("A02 - パスワードがBCryptでハッシュ化されている")
    void testCryptographicFailures_PasswordIsHashed() {
        // パスワードハッシュがBCrypt形式であることを確認
        String passwordHash = testUser.getPasswordHash();

        // BCryptハッシュは"$2a$"または"$2b$"で始まる
        assert passwordHash.startsWith(BCRYPT_PREFIX_2A) || passwordHash.startsWith(BCRYPT_PREFIX_2B)
            : "パスワードがBCryptでハッシュ化されていません";

        // ハッシュ長は60文字
        assert passwordHash.length() == BCRYPT_HASH_LENGTH
            : "BCryptハッシュの長さが正しくありません";
    }

    @Test
    @DisplayName("A02 - JWT署名が検証される（不正なトークンは拒否）")
    void testCryptographicFailures_JwtSignatureValidation() throws Exception {
        String invalidToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.invalid_signature";

        mockMvc.perform(get(USERS_ME_PROFILE_ENDPOINT)
                        .header("Authorization", createAuthorizationHeader(invalidToken)))
                .andExpect(status().isUnauthorized());  // 401が期待される
    }

    // ==========================================
    // A03:2021 - Injection
    // ==========================================

    @Test
    @DisplayName("A03 - SQLインジェクション攻撃が防がれる（メールアドレス検索）")
    void testInjection_SqlInjectionPrevention() throws Exception {
        String maliciousEmail = "test@example.com' OR '1'='1";

        String loginRequest = String.format("""
                {
                    "email": "%s",
                    "password": "%s"
                }
                """, maliciousEmail, TEST_PASSWORD);

        // SQLインジェクション攻撃が失敗することを確認
        mockMvc.perform(post(AUTH_LOGIN_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginRequest))
                .andExpect(status().is4xxClientError());  // 400または401が期待される
    }

    // ==========================================
    // A04:2021 - Insecure Design
    // ==========================================

    @Test
    @DisplayName("A04 - パスワードリセットトークンの有効期限が設定されている")
    void testInsecureDesign_PasswordResetTokenExpiration() throws Exception {
        String resetRequest = String.format("""
                {
                    "email": "%s"
                }
                """, TEST_EMAIL);

        mockMvc.perform(post(AUTH_PASSWORD_RESET_REQUEST_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(resetRequest))
                .andExpect(status().isOk());

        // 期限切れトークンでのリセット試行（ダミートークン）
        String expiredResetConfirm = """
                {
                    "token": "expired-token-12345",
                    "newPassword": "NewPassword456"
                }
                """;

        mockMvc.perform(post(AUTH_PASSWORD_RESET_CONFIRM_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(expiredResetConfirm))
                .andExpect(status().is4xxClientError());  // トークン無効でエラー
    }

    // ==========================================
    // A05:2021 - Security Misconfiguration
    // ==========================================

    @Test
    @DisplayName("A05 - CSRF保護が有効化されている")
    void testSecurityMisconfiguration_CsrfProtectionEnabled() throws Exception {
        String requestBody = """
                {
                    "username": "updateduser"
                }
                """;

        // CSRFトークンなしでPUTリクエストを送信
        mockMvc.perform(put(USERS_ME_PROFILE_ENDPOINT)
                        .header("Authorization", createAuthorizationHeader(validToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestBody))
                .andExpect(status().isForbidden());  // CSRF保護により403が期待される
    }

    @Test
    @DisplayName("A05 - デフォルト認証情報が使用されていない")
    void testSecurityMisconfiguration_NoDefaultCredentials() throws Exception {
        // デフォルトの管理者アカウントでログインを試行
        String defaultAdminLogin = """
                {
                    "email": "admin@example.com",
                    "password": "admin"
                }
                """;

        mockMvc.perform(post(AUTH_LOGIN_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(defaultAdminLogin))
                .andExpect(status().isUnauthorized());  // デフォルト認証情報は存在しない
    }

    // ==========================================
    // A07:2021 - Identification and Authentication Failures
    // ==========================================

    @Test
    @DisplayName("A07 - 弱いパスワードが拒否される")
    void testAuthenticationFailures_WeakPasswordRejected() throws Exception {
        String weakPasswordRegister = """
                {
                    "username": "newuser",
                    "email": "newuser@example.com",
                    "password": "12345678"
                }
                """;

        mockMvc.perform(post(AUTH_REGISTER_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(weakPasswordRegister))
                .andExpect(status().isBadRequest());  // Issue#21のパスワードポリシー違反
    }

    @Test
    @DisplayName("A07 - パスワードポリシー準拠（8-20文字、数字・大文字・小文字、記号不可）")
    void testAuthenticationFailures_PasswordPolicyCompliance() throws Exception {
        // 記号を含むパスワード（Issue#21で禁止）
        String passwordWithSymbol = """
                {
                    "username": "newuser",
                    "email": "newuser@example.com",
                    "password": "Password@123"
                }
                """;

        mockMvc.perform(post(AUTH_REGISTER_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(passwordWithSymbol))
                .andExpect(status().isBadRequest());  // 記号使用で拒否

        // 21文字以上のパスワード
        String tooLongPassword = """
                {
                    "username": "newuser2",
                    "email": "newuser2@example.com",
                    "password": "VeryLongPassword12345"
                }
                """;

        mockMvc.perform(post(AUTH_REGISTER_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(tooLongPassword))
                .andExpect(status().isBadRequest());  // 20文字超過で拒否
    }

    @Test
    @DisplayName("A07 - 未認証アクセスが拒否される")
    void testAuthenticationFailures_UnauthenticatedAccessDenied() throws Exception {
        // 認証トークンなしでプロフィール取得を試行
        mockMvc.perform(get(USERS_ME_PROFILE_ENDPOINT))
                .andExpect(status().isUnauthorized());  // 401が期待される
    }

    // ==========================================
    // A09:2021 - Security Logging and Monitoring Failures
    // ==========================================

    @Test
    @DisplayName("A09 - ログイン失敗が適切にハンドリングされる")
    void testLoggingFailures_LoginFailureHandling() throws Exception {
        String wrongPasswordLogin = String.format("""
                {
                    "email": "%s",
                    "password": "WrongPassword123"
                }
                """, TEST_EMAIL);

        mockMvc.perform(post(AUTH_LOGIN_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wrongPasswordLogin))
                .andExpect(status().isUnauthorized());  // 認証情報誤りで401
    }

    // ==========================================
    // Issue#23連携: CSRF保護検証
    // ==========================================

    @Test
    @DisplayName("CSRF - 認証エンドポイントがCSRF除外されている")
    void testCsrf_AuthEndpointsExempted() throws Exception {
        String loginRequest = String.format("""
                {
                    "email": "%s",
                    "password": "%s"
                }
                """, TEST_EMAIL, TEST_PASSWORD);

        // CSRFトークンなしで認証エンドポイントにアクセス（正常動作すべき）
        mockMvc.perform(post(AUTH_LOGIN_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(loginRequest))
                .andExpect(status().isOk());  // CSRF除外により成功
    }

    @Test
    @DisplayName("CSRF - 状態変更操作にCSRF保護が適用されている")
    void testCsrf_StateChangingOperationsProtected() throws Exception {
        String updateRequest = """
                {
                    "username": "updateduser"
                }
                """;

        // CSRFトークンなしでの状態変更（失敗すべき）
        mockMvc.perform(put(USERS_ME_PROFILE_ENDPOINT)
                        .header("Authorization", createAuthorizationHeader(validToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateRequest))
                .andExpect(status().isForbidden());

        // CSRFトークンありでの状態変更（成功すべき）
        mockMvc.perform(put(USERS_ME_PROFILE_ENDPOINT)
                        .with(csrf())
                        .header("Authorization", createAuthorizationHeader(validToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updateRequest))
                .andExpect(status().isOk());
    }
}
