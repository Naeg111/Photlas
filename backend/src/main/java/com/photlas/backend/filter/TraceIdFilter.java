package com.photlas.backend.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * トレース ID フィルタ
 * Issue#95: X-Amzn-Trace-Id を MDC に格納し、レスポンスヘッダに X-Trace-Id として返す。
 *
 * 動作:
 *   - ALB ヘッダ X-Amzn-Trace-Id から Root= 部分のみを抽出して MDC に格納
 *   - ALB ヘッダが無い場合は Root=local-{UUID} を生成
 *   - レスポンスヘッダ X-Trace-Id にも同じ値を付与（クライアントが障害報告時に参照できる）
 *   - フィルタ通過後は MDC.remove() で必ずクリア（スレッドプール汚染防止）
 *
 * 最前段で動くよう @Order(Ordered.HIGHEST_PRECEDENCE) を付与。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceIdFilter extends OncePerRequestFilter {

    private static final String MDC_TRACE_ID_KEY = "traceId";
    private static final String REQUEST_HEADER = "X-Amzn-Trace-Id";
    private static final String RESPONSE_HEADER = "X-Trace-Id";
    private static final String ROOT_PREFIX = "Root=";
    private static final String LOCAL_PREFIX = "Root=local-";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {
        String traceId = resolveTraceId(request.getHeader(REQUEST_HEADER));
        MDC.put(MDC_TRACE_ID_KEY, traceId);
        response.setHeader(RESPONSE_HEADER, traceId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_TRACE_ID_KEY);
        }
    }

    /**
     * リクエストヘッダ値から MDC に格納するトレース ID を決定する。
     *   - null / 空文字 → Root=local-{UUID} を新規生成
     *   - "Root=..." を含む（ALB 標準）→ Root= から次の ";" までを抽出
     *   - それ以外 → ヘッダ値全体をそのまま使う（後方互換・想定外形式フォールバック）
     */
    private String resolveTraceId(String headerValue) {
        if (headerValue == null || headerValue.isEmpty()) {
            return LOCAL_PREFIX + UUID.randomUUID();
        }
        int rootIndex = headerValue.indexOf(ROOT_PREFIX);
        if (rootIndex < 0) {
            return headerValue;
        }
        int semicolonIndex = headerValue.indexOf(';', rootIndex);
        if (semicolonIndex < 0) {
            return headerValue.substring(rootIndex);
        }
        return headerValue.substring(rootIndex, semicolonIndex);
    }
}
