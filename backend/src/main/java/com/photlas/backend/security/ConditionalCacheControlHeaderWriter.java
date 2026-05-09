package com.photlas.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.security.SecurityProperties;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.RegexRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * Issue#127: パスごとに Cache-Control を出し分ける Servlet Filter。
 *
 * <p>対象 8 系統の公開 GET エンドポイントは {@code Cache-Control: public, max-age=<TTL>}
 * を返し、それ以外は従来の Spring Security デフォルトに任せる。これにより
 * CloudFront `/api/*` Behavior（{@code Managed-CachingOptimized}）と組み合わせて
 * 対象 API のみを CDN キャッシュ可能化する。</p>
 *
 * <p>当初は Spring Security の {@code HeaderWriter} として実装したが、
 * {@code .cacheControl(c -> c.disable()).addHeaderWriter(...)} の組み合わせでは
 * Spring Security 6.4 系で本 writer が呼ばれない事象があったため、
 * Spring Security フィルタチェーンの「直後」に走る独立した Servlet Filter
 * として再実装した。これにより Spring Security の HeaderWriter 仕組みに
 * 一切依存しない。</p>
 *
 * <p>動作:</p>
 * <ol>
 *   <li>chain.doFilter(req, res) で Spring Security とコントローラーが走る
 *       （Spring Security の default {@code CacheControlHeadersWriter} がここで
 *       no-cache 系ヘッダをセットする）。</li>
 *   <li>本 Filter が return path で対象パスかつ 2xx 成功なら、
 *       {@code Cache-Control} を {@code public, max-age=<TTL>} に上書きし、
 *       {@code Pragma} / {@code Expires} を空文字に上書き
 *       （CloudFront が {@code Pragma: no-cache} を理由にキャッシュをスキップする
 *       問題を回避するため）。</li>
 *   <li>それ以外（対象外 / 4xx / 5xx）は何もせず、Spring Security の
 *       no-cache 系ヘッダがそのまま返る。</li>
 * </ol>
 *
 * <p>controller が {@code ResponseEntity.cacheControl(...)} で独自に Cache-Control を
 * 設定済みの場合（{@code ViewportBounceController} の {@code no-store} 等）は
 * Spring Security の writer がそれを尊重するため、本 Filter も結果を尊重する
 * 設計になっている。</p>
 */
@Component
@Order(SecurityProperties.DEFAULT_FILTER_ORDER + 100)
public class ConditionalCacheControlHeaderWriter extends OncePerRequestFilter {

    /**
     * 対象パスごとに TTL（秒）を持たせるためのレコード。
     * 先頭から評価し最初にマッチしたものを採用する。
     */
    private record CacheableRule(RequestMatcher matcher, int maxAgeSeconds) {}

    // AntPathRequestMatcher は path 内の {var} で正規表現制約を表現できないため、
    // 数値 userId に厳密マッチさせたい /users/\d+ 系は RegexRequestMatcher を使う。
    // /api/v1/users/me（自分のリソース、個人情報を含むためキャッシュ不可）は \d+ では
    // マッチしないので意図的に除外される。
    private static final List<CacheableRule> CACHEABLE_RULES = List.of(
            new CacheableRule(new AntPathRequestMatcher("/api/v1/spots", "GET"), 60),
            new CacheableRule(new AntPathRequestMatcher("/api/v1/categories", "GET"), 300),
            new CacheableRule(new AntPathRequestMatcher("/api/v1/ogp/photo/*", "GET"), 300),
            new CacheableRule(new AntPathRequestMatcher("/api/v1/sitemap.xml", "GET"), 3600),
            new CacheableRule(new AntPathRequestMatcher("/api/v1/sitemap-static.xml", "GET"), 3600),
            new CacheableRule(new AntPathRequestMatcher("/api/v1/sitemap-photos-*.xml", "GET"), 3600),
            new CacheableRule(new RegexRequestMatcher("/api/v1/users/\\d+", "GET"), 60),
            new CacheableRule(new RegexRequestMatcher("/api/v1/users/\\d+/photos", "GET"), 60)
    );

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        chain.doFilter(req, res);

        // chain 完了後（Spring Security の HeaderWriter 群が走った後）に上書きする
        if (!isStatus2xx(res.getStatus())) {
            // 4xx / 5xx エラーは対象パスでも no-cache のまま（Spring Security デフォルトに任せる）
            return;
        }

        Optional<CacheableRule> matched = CACHEABLE_RULES.stream()
                .filter(rule -> rule.matcher().matches(req))
                .findFirst();

        if (matched.isPresent() && !isControllerSetCacheControl(res)) {
            // 対象 API + 2xx 成功 + controller が独自 Cache-Control を設定していない: 上書き
            res.setHeader(HttpHeaders.CACHE_CONTROL,
                    "public, max-age=" + matched.get().maxAgeSeconds());
            // Pragma / Expires は空文字に上書き（CloudFront キャッシュ阻害回避）
            res.setHeader(HttpHeaders.PRAGMA, "");
            res.setHeader(HttpHeaders.EXPIRES, "");
        }
        // それ以外は何もしない（Spring Security デフォルトの no-cache がそのまま使われる）
    }

    /**
     * controller が独自に Cache-Control を設定したかどうかを判定する。
     *
     * <p>Spring Security の default {@code CacheControlHeadersWriter} は no-cache
     * 系の固定文字列をセットするため、それ以外の値が入っていれば「controller 由来」と
     * 判定する。具体的には {@code ViewportBounceController} の {@code no-store}
     * や {@code DataExportController} の {@code no-store} を尊重する目的。</p>
     */
    private static boolean isControllerSetCacheControl(HttpServletResponse res) {
        String cacheControl = res.getHeader(HttpHeaders.CACHE_CONTROL);
        if (cacheControl == null) {
            return false;
        }
        return !cacheControl.equals("no-cache, no-store, max-age=0, must-revalidate");
    }

    private static boolean isStatus2xx(int status) {
        return status >= 200 && status < 300;
    }
}
