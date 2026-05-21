package com.photlas.backend.filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * レスポンスに {@code X-Robots-Tag: noindex, nofollow} ヘッダを付与するフィルタ。
 *
 * <p>API ホスト（{@code api.photlas.jp} / {@code test-api.photlas.jp}）や {@code /api/*}・
 * {@code /robots.txt} 等は SEO 対象外であり、Google 等にインデックスされるのは望ましくない。
 * robots.txt（{@link com.photlas.backend.controller.RobotsTxtController}）はクロール禁止指示だが、
 * 既にインデックスされている URL を除外するには {@code X-Robots-Tag: noindex} が必要。</p>
 *
 * <p><b>Issue#136 §9 / #58 §6</b>: ただし <b>本番</b>（{@code app.frontend-url=https://photlas.jp}）の
 * {@code /tags/**}・{@code /photo-viewer/**} は SEO ターゲットの SSR ページなので noindex を付けない。
 * これらはもともと backend で配信されていなかったが、配信経路の修正（CloudFront/ALB）で届くように
 * なったため、無条件の noindex を外す必要がある。<b>ステージング</b>（および本番以外）は Issue#143 の
 * サイト全体 noindex 方針に従い、{@code /tags}・{@code /photo-viewer} も含めて noindex を維持する。</p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class XRobotsTagFilter extends OncePerRequestFilter {

    private static final String HEADER_NAME = "X-Robots-Tag";
    private static final String HEADER_VALUE = "noindex, nofollow";
    private static final String PRODUCTION_FRONTEND_URL = "https://photlas.jp";

    /** 本番でインデックス対象とする SSR ページのパス接頭辞。 */
    private static final String[] INDEXABLE_PREFIXES = {"/tags/", "/photo-viewer/"};

    private final boolean productionEnv;

    public XRobotsTagFilter(@Value("${app.frontend-url}") String frontendUrl) {
        this.productionEnv = PRODUCTION_FRONTEND_URL.equals(frontendUrl);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (!isIndexableOnProduction(request.getRequestURI())) {
            response.setHeader(HEADER_NAME, HEADER_VALUE);
        }
        filterChain.doFilter(request, response);
    }

    /**
     * 本番かつ SEO 対象の SSR ページ（{@code /tags/**}・{@code /photo-viewer/**}）なら true
     * （= noindex を付けない）。本番以外、または対象外パスでは false（= noindex を付ける）。
     */
    private boolean isIndexableOnProduction(String requestUri) {
        if (!productionEnv || requestUri == null) {
            return false;
        }
        for (String prefix : INDEXABLE_PREFIXES) {
            if (requestUri.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }
}
