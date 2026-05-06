package com.photlas.backend.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 全レスポンスに {@code X-Robots-Tag: noindex, nofollow} ヘッダを付与するフィルタ。
 *
 * <p>API ホスト（{@code api.photlas.jp} / {@code test-api.photlas.jp}）は SEO 対象外であり、
 * Google 等の検索エンジンがインデックスするのは望ましくない。
 * robots.txt（{@link com.photlas.backend.controller.RobotsTxtController}）はクロール禁止指示だが、
 * 既にインデックスされている URL を除外するには {@code X-Robots-Tag: noindex} が必要。
 *
 * <p>OGP エンドポイント（{@code /api/v1/ogp/**}）にも適用されるが、
 * Twitter/Facebook 等の OGP カード生成には影響しない（OG タグ自体は読まれる）。</p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class XRobotsTagFilter extends OncePerRequestFilter {

    private static final String HEADER_NAME = "X-Robots-Tag";
    private static final String HEADER_VALUE = "noindex, nofollow";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        response.setHeader(HEADER_NAME, HEADER_VALUE);
        filterChain.doFilter(request, response);
    }
}
