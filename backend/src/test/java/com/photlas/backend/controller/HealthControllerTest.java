package com.photlas.backend.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * HealthController のテストクラス
 * TDD Red-Green-Refactor サイクルでの開発
 * 
 * Issue#1 要件:
 * - GET /api/v1/health エンドポイント
 * - 200 OK ステータス
 * - {"status":"UP"} レスポンス
 */
@WebMvcTest(HealthController.class)
class HealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthEndpoint_shouldReturn200OK() throws Exception {
        // Red: このテストは最初失敗する（HealthControllerが存在しないため）
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk());
    }

    @Test
    void healthEndpoint_shouldReturnCorrectContentType() throws Exception {
        // Red: JSONコンテンツタイプの確認
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"));
    }

    @Test
    void healthEndpoint_shouldReturnStatusUp() throws Exception {
        // Red: 正確なレスポンス内容の確認
        mockMvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
