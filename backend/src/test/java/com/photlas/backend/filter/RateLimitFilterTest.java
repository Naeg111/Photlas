package com.photlas.backend.filter;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * RateLimitFilter のテスト
 * Issue#22: API Rate Limiting の実装
 * Issue#95: レート制限カテゴリ整理（sensitive 新設・フォールバック方式・URL デコード対策）
 *
 * TDD Red段階: 実装前のテストケース定義
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@org.springframework.test.context.TestPropertySource(properties = {
    "rate-limit.auth=10",
    "rate-limit.sensitive=3",
    "rate-limit.photo=30",
    "rate-limit.general=80"
})
public class RateLimitFilterTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        // テスト前にレート制限のキャッシュをクリアする
        rateLimitFilter.clearCache();
    }

    @Test
    @DisplayName("レート制限内のリクエストは正常に通過する")
    void testRateLimitFilter_WithinLimit_RequestSucceeds() throws Exception {
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("認証エンドポイント: 10リクエスト/分を超えるとHTTP 429を返す")
    void testRateLimitFilter_AuthEndpoint_ExceedsLimit_Returns429() throws Exception {
        String registerUrl = "/api/v1/auth/register";

        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post(registerUrl)
                    .contentType("application/json")
                    .content("{}"))
                    .andExpect(status().is4xxClientError());
        }

        mockMvc.perform(post(registerUrl)
                .with(csrf())
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    @DisplayName("写真エンドポイント: 30リクエスト/分を超えるとHTTP 429を返す")
    void testRateLimitFilter_PhotoEndpoint_ExceedsLimit_Returns429() throws Exception {
        String photoUrl = "/api/v1/photos";

        for (int i = 0; i < 30; i++) {
            mockMvc.perform(post(photoUrl)
                    .contentType("application/json")
                    .content("{}"))
                    .andExpect(status().is4xxClientError());
        }

        mockMvc.perform(post(photoUrl)
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    @DisplayName("一般エンドポイント: 80リクエスト/分を超えるとHTTP 429を返す（Issue#95: 60→80に引き上げ）")
    void testRateLimitFilter_GeneralEndpoint_ExceedsLimit_Returns429() throws Exception {
        String healthUrl = "/api/v1/health";

        for (int i = 0; i < 80; i++) {
            mockMvc.perform(get(healthUrl))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get(healthUrl))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    @DisplayName("Retry-Afterヘッダーに60秒が設定される")
    void testRateLimitFilter_RetryAfterHeader_Returns60Seconds() throws Exception {
        String registerUrl = "/api/v1/auth/register";

        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post(registerUrl)
                    .with(csrf())
                    .contentType("application/json")
                    .content("{}"));
        }

        mockMvc.perform(post(registerUrl)
                .with(csrf())
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"));
    }

    @Test
    @DisplayName("キャッシュのTTL経過後はレート制限がリセットされる")
    void testRateLimitFilter_AfterTTLExpiry_LimitResets() throws Exception {
        String registerUrl = "/api/v1/auth/register";

        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post(registerUrl)
                    .with(csrf())
                    .contentType("application/json")
                    .content("{}"));
        }

        mockMvc.perform(post(registerUrl)
                .with(csrf())
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests());

        rateLimitFilter.expireAllEntries();

        mockMvc.perform(post(registerUrl)
                .with(csrf())
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @DisplayName("異なるIPアドレスからのリクエストは独立してレート制限される")
    void testRateLimitFilter_DifferentIPs_IndependentLimits() throws Exception {
        String healthUrl = "/api/v1/health";

        for (int i = 0; i < 80; i++) {
            mockMvc.perform(get(healthUrl)
                    .header("X-Forwarded-For", "192.168.1.1"))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get(healthUrl)
                .header("X-Forwarded-For", "192.168.1.1"))
                .andExpect(status().isTooManyRequests());

        mockMvc.perform(get(healthUrl)
                .header("X-Forwarded-For", "192.168.1.2"))
                .andExpect(status().isOk());
    }

    // ===== Issue#95: sensitive カテゴリ（3 req/分、メール送信系の厳格制限） =====

    @Test
    @DisplayName("Issue#95 - sensitive: /resend-verification が3 req/分を超えるとHTTP 429を返す")
    void testRateLimitFilter_ResendVerification_ExceedsSensitiveLimit_Returns429() throws Exception {
        String url = "/api/v1/auth/resend-verification";

        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post(url)
                    .with(csrf())
                    .contentType("application/json")
                    .content("{}"))
                    .andExpect(status().is4xxClientError());
        }

        mockMvc.perform(post(url)
                .with(csrf())
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    @DisplayName("Issue#95 - sensitive: /password-reset-request が3 req/分を超えるとHTTP 429を返す")
    void testRateLimitFilter_PasswordResetRequest_ExceedsSensitiveLimit_Returns429() throws Exception {
        String url = "/api/v1/auth/password-reset-request";

        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post(url)
                    .with(csrf())
                    .contentType("application/json")
                    .content("{}"))
                    .andExpect(status().is4xxClientError());
        }

        mockMvc.perform(post(url)
                .with(csrf())
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    // ===== Issue#95: authカテゴリへのフォールバック（/api/v1/auth/ 配下でsensitive以外は全部10/分） =====

    @Test
    @DisplayName("Issue#95 - auth fallback: /verify-email は auth カテゴリ(10/分)にフォールバック")
    void testRateLimitFilter_VerifyEmail_FallsBackToAuth() throws Exception {
        String url = "/api/v1/auth/verify-email?token=dummy";

        // 10 回成功、11 回目で 429（auth カテゴリの挙動）
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(get(url))
                    .andExpect(status().is4xxClientError());
        }

        mockMvc.perform(get(url))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("Issue#95 - auth fallback: /reset-password は auth カテゴリ(10/分)にフォールバック")
    void testRateLimitFilter_ResetPassword_FallsBackToAuth() throws Exception {
        String url = "/api/v1/auth/reset-password";

        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post(url)
                    .with(csrf())
                    .contentType("application/json")
                    .content("{}"))
                    .andExpect(status().is4xxClientError());
        }

        mockMvc.perform(post(url)
                .with(csrf())
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("Issue#95 - auth fallback: /confirm-email-change は auth カテゴリ(10/分)にフォールバック")
    void testRateLimitFilter_ConfirmEmailChange_FallsBackToAuth() throws Exception {
        String url = "/api/v1/auth/confirm-email-change?token=dummy";

        for (int i = 0; i < 10; i++) {
            mockMvc.perform(get(url))
                    .andExpect(status().is4xxClientError());
        }

        mockMvc.perform(get(url))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    @DisplayName("Issue#95 - auth fallback: 未登録の /api/v1/auth/* パスもauthカテゴリにフォールバック（セキュア側）")
    void testRateLimitFilter_UnknownAuthPath_FallsBackToAuth() throws Exception {
        // 実在しない想定のパス。404/403/405 系が返るが、
        // レート制限フィルタは auth カテゴリ(10/分)で判定することを期待。
        String url = "/api/v1/auth/something-new";

        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post(url)
                    .with(csrf())
                    .contentType("application/json")
                    .content("{}"))
                    .andExpect(status().is4xxClientError());
        }

        mockMvc.perform(post(url)
                .with(csrf())
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests());
    }

    // ===== Issue#95: URL エンコード回避攻撃の回帰テスト =====

    @Test
    @DisplayName("Issue#95 - URLデコード: /password%2Dreset%2Drequest は sensitive(3/分)として扱われる")
    void testRateLimitFilter_UrlEncodedSensitivePath_TreatedAsSensitive() throws Exception {
        // "-" を %2D にエンコードしたパスで SENSITIVE_PATHS の完全一致をすり抜けようとする攻撃。
        // Spring が内部でデコードするため、getServletPath() 使用で sensitive として判定される。
        //
        // MockMvc の post(String) は URI テンプレート扱いで "%2D" を "%252D" に二重エンコードし、
        // Spring Security の StrictHttpFirewall に弾かれて 400 になるため、URI.create() で
        // 生のエンコード済みパスをそのまま渡す。
        URI uri = URI.create("/api/v1/auth/password%2Dreset%2Drequest");

        for (int i = 0; i < 3; i++) {
            mockMvc.perform(post(uri)
                    .with(csrf())
                    .contentType("application/json")
                    .content("{}"))
                    .andExpect(status().is4xxClientError());
        }

        // 4回目は sensitive 制限で 429（general=80, auth=10 ではなく sensitive=3）
        mockMvc.perform(post(uri)
                .with(csrf())
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests());
    }

    // ===== Issue#95: photo カテゴリの偽一致防止 =====

    @Test
    @DisplayName("Issue#95 - photo 偽一致防止: /api/v1/photos-sitemap 等は general カテゴリで扱われる")
    void testRateLimitFilter_PhotosSitemap_TreatedAsGeneral() throws Exception {
        // "/api/v1/photos" の startsWith だけで判定していた旧実装では
        // /api/v1/photos-sitemap も photo カテゴリ(30/分)に誤分類されてしまう。
        // PHOTO_PATH_EXACT（完全一致）と PHOTO_PATH_PREFIX（/api/v1/photos/）で分離した新実装では
        // general カテゴリ(80/分)で扱われることを確認する。
        // 31 回リクエストしても 429 にならないこと（= photo ではない）を検証。
        String url = "/api/v1/photos-sitemap";

        int nonBlocked = 0;
        for (int i = 0; i < 31; i++) {
            MvcResult result = mockMvc.perform(get(url)).andReturn();
            int status = result.getResponse().getStatus();
            if (status != 429) {
                nonBlocked++;
            }
        }
        // photo カテゴリなら 30 回で頭打ちになるはず。general(80) 扱いなら 31 回とも通過。
        assertEquals(31, nonBlocked,
                "photos-sitemap は photo(30/分) ではなく general(80/分) として扱われるべき");
    }

    // ===== Issue#95: 429 レスポンスの JSON ボディ検証 =====

    @Test
    @DisplayName("Issue#95 - 429レスポンス: Content-Typeがapplication/jsonでWAFと同一のJSON構造を返す")
    void testRateLimitFilter_429Response_BodyMatchesWafJsonStructure() throws Exception {
        String registerUrl = "/api/v1/auth/register";

        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post(registerUrl)
                    .with(csrf())
                    .contentType("application/json")
                    .content("{}"));
        }

        MvcResult result = mockMvc.perform(post(registerUrl)
                .with(csrf())
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"))
                .andReturn();

        String contentType = result.getResponse().getContentType();
        assertTrue(contentType != null && contentType.toLowerCase().contains("application/json"),
                "Content-Type should be application/json but was: " + contentType);

        String body = result.getResponse().getContentAsString();
        // WAF の CustomResponseBodies と完全一致：error / code / message / retryAfter の 4 キー
        assertTrue(body.contains("\"error\":\"Too Many Requests\""),
                "body should contain error key: " + body);
        assertTrue(body.contains("\"code\":\"RATE_LIMIT_EXCEEDED\""),
                "body should contain code key: " + body);
        assertTrue(body.contains("\"message\":\"Too many requests. Please retry after some time.\""),
                "body should contain message key: " + body);
        assertTrue(body.contains("\"retryAfter\":60"),
                "body should contain retryAfter: 60 - got: " + body);
    }

    // ===== Issue#95: 認証済みユーザーの user:{email} 単位識別（PR3 フィルタ順序変更） =====

    @Test
    @DisplayName("Issue#95 - PR3: 認証済みユーザーはuser:{email}単位で識別され、別ユーザーは独立したレート制限を持つ")
    void testRateLimitFilter_AuthenticatedUser_PerUserIdentification() throws Exception {
        // 2 ユーザーを作成
        User userA = new User();
        userA.setUsername("userA");
        userA.setEmail("usera@example.com");
        userA.setPasswordHash("hashedA");
        userA.setRole(CodeConstants.ROLE_USER);
        userA = userRepository.save(userA);

        User userB = new User();
        userB.setUsername("userB");
        userB.setEmail("userb@example.com");
        userB.setPasswordHash("hashedB");
        userB.setRole(CodeConstants.ROLE_USER);
        userB = userRepository.save(userB);

        String tokenA = jwtService.generateToken(userA.getEmail());
        String tokenB = jwtService.generateToken(userB.getEmail());

        String registerUrl = "/api/v1/auth/register";

        // userA の JWT で auth 制限(10)を使い切る
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post(registerUrl)
                    .with(csrf())
                    .header("Authorization", "Bearer " + tokenA)
                    .contentType("application/json")
                    .content("{}"));
        }

        // userA はもう 429
        mockMvc.perform(post(registerUrl)
                .with(csrf())
                .header("Authorization", "Bearer " + tokenA)
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests());

        // userB は独立したキー（user:emailB）なので通過する（PR3でフィルタ順序を修正した場合のみ成立）
        mockMvc.perform(post(registerUrl)
                .with(csrf())
                .header("Authorization", "Bearer " + tokenB)
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().is4xxClientError());
    }
}
