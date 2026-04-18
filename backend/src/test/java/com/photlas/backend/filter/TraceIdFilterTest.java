package com.photlas.backend.filter;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * TraceIdFilter のテスト
 * Issue#95: ログの相関性改善（X-Amzn-Trace-Id の MDC 格納とレスポンスヘッダ付与）
 *
 * TDD Red段階: 実装前のテストケース定義
 */
public class TraceIdFilterTest {

    private TraceIdFilter filter;

    @BeforeEach
    void setUp() {
        filter = new TraceIdFilter();
        MDC.clear();
    }

    @Test
    @DisplayName("Issue#95 - Root= 部分のみが MDC に格納される")
    void testDoFilterInternal_ExtractsRootIdFromAlbHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        String albHeader = "Root=1-5759e988-bd862e3fe1be46a994272793;Parent=53995c3f42cd8ad8;Sampled=1";
        request.addHeader("X-Amzn-Trace-Id", albHeader);

        // フィルタ内で MDC を検査するため、FilterChain の中で MDC を記録
        final String[] capturedTraceId = new String[1];
        FilterChain chain = (req, res) -> capturedTraceId[0] = MDC.get("traceId");

        filter.doFilter(request, response, chain);

        assertEquals("Root=1-5759e988-bd862e3fe1be46a994272793", capturedTraceId[0],
                "Root= 部分のみ抽出されるべき（Parent/Sampled は除外）");
    }

    @Test
    @DisplayName("Issue#95 - Root= を含まない想定外形式の場合はヘッダ値全体がフォールバック")
    void testDoFilterInternal_FallsBackToFullHeaderWhenNoRootPrefix() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        String unknownFormat = "CustomTraceFormat=abc123";
        request.addHeader("X-Amzn-Trace-Id", unknownFormat);

        final String[] capturedTraceId = new String[1];
        FilterChain chain = (req, res) -> capturedTraceId[0] = MDC.get("traceId");

        filter.doFilter(request, response, chain);

        assertEquals(unknownFormat, capturedTraceId[0],
                "Root= を含まない想定外形式はヘッダ値全体がフォールバックとして格納されるべき");
    }

    @Test
    @DisplayName("Issue#95 - ヘッダ欠落時は Root=local-{UUID} 形式のフォールバック値が生成される")
    void testDoFilterInternal_GeneratesLocalUuidWhenHeaderMissing() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        final String[] capturedTraceId = new String[1];
        FilterChain chain = (req, res) -> capturedTraceId[0] = MDC.get("traceId");

        filter.doFilter(request, response, chain);

        assertNotNull(capturedTraceId[0], "trace ID は常に生成されるべき");
        assertTrue(capturedTraceId[0].startsWith("Root=local-"),
                "ALB ヘッダなしの場合は Root=local-{UUID} 形式 - got: " + capturedTraceId[0]);
    }

    @Test
    @DisplayName("Issue#95 - レスポンスヘッダ X-Trace-Id に MDC と同じ値が設定される")
    void testDoFilterInternal_SetsResponseTraceIdHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        String albHeader = "Root=1-5759e988-bd862e3fe1be46a994272793;Parent=53995c3f42cd8ad8;Sampled=1";
        request.addHeader("X-Amzn-Trace-Id", albHeader);

        filter.doFilter(request, response, new MockFilterChain());

        String responseHeader = response.getHeader("X-Trace-Id");
        assertEquals("Root=1-5759e988-bd862e3fe1be46a994272793", responseHeader,
                "レスポンスヘッダ X-Trace-Id に Root= 抽出値が設定されるべき");
    }

    @Test
    @DisplayName("Issue#95 - フィルタ通過後は MDC がクリアされる")
    void testDoFilterInternal_ClearsMdcAfterFilterChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        request.addHeader("X-Amzn-Trace-Id",
                "Root=1-5759e988-bd862e3fe1be46a994272793;Parent=53995c3f42cd8ad8;Sampled=1");

        filter.doFilter(request, response, new MockFilterChain());

        assertNull(MDC.get("traceId"),
                "フィルタ通過後の MDC は clear されるべき（スレッドプール汚染防止）");
    }
}
