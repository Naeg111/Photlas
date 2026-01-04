package com.photlas.backend.filter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.is;

/**
 * RateLimitFilter のテスト
 * Issue#22: API Rate Limiting の実装
 *
 * TDD Red段階: 実装前のテストケース定義
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class RateLimitFilterTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    @BeforeEach
    void setUp() {
        // テスト前にレート制限のキャッシュをクリアする
        rateLimitFilter.clearCache();
    }

    @Test
    @DisplayName("レート制限内のリクエストは正常に通過する")
    void testRateLimitFilter_WithinLimit_RequestSucceeds() throws Exception {
        // 一般エンドポイントに対して1回のリクエスト（60 req/minの制限内）
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("認証エンドポイント: 10リクエスト/分を超えるとHTTP 429を返す")
    void testRateLimitFilter_AuthEndpoint_ExceedsLimit_Returns429() throws Exception {
        String registerUrl = "/api/v1/users/register";

        // 10回のリクエストは成功する
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post(registerUrl)
                    .contentType("application/json")
                    .content("{}"))
                    .andExpect(status().is4xxClientError()); // バリデーションエラーだが、レート制限は通過
        }

        // 11回目のリクエストはレート制限で拒否される
        mockMvc.perform(post(registerUrl)
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    @DisplayName("写真エンドポイント: 30リクエスト/分を超えるとHTTP 429を返す")
    void testRateLimitFilter_PhotoEndpoint_ExceedsLimit_Returns429() throws Exception {
        String photoUrl = "/api/v1/photos";

        // 30回のリクエストは成功する（認証エラーにはなるが、レート制限は通過）
        for (int i = 0; i < 30; i++) {
            mockMvc.perform(get(photoUrl))
                    .andExpect(status().is4xxClientError()); // 認証エラーだが、レート制限は通過
        }

        // 31回目のリクエストはレート制限で拒否される
        mockMvc.perform(get(photoUrl))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    @DisplayName("一般エンドポイント: 60リクエスト/分を超えるとHTTP 429を返す")
    void testRateLimitFilter_GeneralEndpoint_ExceedsLimit_Returns429() throws Exception {
        String healthUrl = "/api/v1/health";

        // 60回のリクエストは成功する
        for (int i = 0; i < 60; i++) {
            mockMvc.perform(get(healthUrl))
                    .andExpect(status().isOk());
        }

        // 61回目のリクエストはレート制限で拒否される
        mockMvc.perform(get(healthUrl))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    @DisplayName("Retry-Afterヘッダーに60秒が設定される")
    void testRateLimitFilter_RetryAfterHeader_Returns60Seconds() throws Exception {
        String registerUrl = "/api/v1/users/register";

        // レート制限を超えるまでリクエストを送信
        for (int i = 0; i < 10; i++) {
            mockMvc.perform(post(registerUrl)
                    .contentType("application/json")
                    .content("{}"));
        }

        // レート制限超過時のRetry-Afterヘッダーを確認
        mockMvc.perform(post(registerUrl)
                .contentType("application/json")
                .content("{}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"));
    }

    @Test
    @DisplayName("異なるIPアドレスからのリクエストは独立してレート制限される")
    void testRateLimitFilter_DifferentIPs_IndependentLimits() throws Exception {
        String healthUrl = "/api/v1/health";

        // IP1から60回のリクエスト
        for (int i = 0; i < 60; i++) {
            mockMvc.perform(get(healthUrl)
                    .header("X-Forwarded-For", "192.168.1.1"))
                    .andExpect(status().isOk());
        }

        // IP1からの61回目はレート制限
        mockMvc.perform(get(healthUrl)
                .header("X-Forwarded-For", "192.168.1.1"))
                .andExpect(status().isTooManyRequests());

        // IP2からのリクエストは成功する（独立したレート制限）
        mockMvc.perform(get(healthUrl)
                .header("X-Forwarded-For", "192.168.1.2"))
                .andExpect(status().isOk());
    }
}
