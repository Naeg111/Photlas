package com.photlas.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

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
public class ConditionalCacheControlHeaderWriter extends OncePerRequestFilter {

    /**
     * 対象パスごとに TTL（秒）を持たせるためのレコード。
     * 先頭から評価し最初にマッチしたものを採用する。
     *
     * <p>マッチング: GET メソッド限定で、URL の path 部分を {@code Pattern} で
     * フル一致確認する。Spring Security の AntPathRequestMatcher /
     * RegexRequestMatcher はバージョン依存の挙動があるため、ここでは標準 java.util.regex
     * のみを使う。</p>
     */
    private record CacheableRule(Pattern pathPattern, int maxAgeSeconds) {}

    // 各パスを Pattern で表現する（フル一致）。
    // \d+ で数字のみマッチさせることで、/api/v1/users/me（個人情報のためキャッシュ不可）
    // を意図的に除外する。
    private static final List<CacheableRule> CACHEABLE_RULES = List.of(
            new CacheableRule(Pattern.compile("/api/v1/spots"), 60),
            new CacheableRule(Pattern.compile("/api/v1/categories"), 300),
            new CacheableRule(Pattern.compile("/api/v1/ogp/photo/[^/]+"), 300),
            new CacheableRule(Pattern.compile("/api/v1/sitemap\\.xml"), 3600),
            new CacheableRule(Pattern.compile("/api/v1/sitemap-static\\.xml"), 3600),
            new CacheableRule(Pattern.compile("/api/v1/sitemap-photos-[^/]+\\.xml"), 3600),
            new CacheableRule(Pattern.compile("/api/v1/users/\\d+"), 60),
            new CacheableRule(Pattern.compile("/api/v1/users/\\d+/photos"), 60)
    );

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        // [TEMP DEBUG Issue#127]
        System.err.println("[Issue#127-FILTER] BEFORE chain: " + req.getMethod() + " " + req.getRequestURI());
        chain.doFilter(req, res);
        System.err.println("[Issue#127-FILTER] AFTER chain: status=" + res.getStatus()
                + " Cache-Control=" + res.getHeader("Cache-Control"));

        // chain 完了後（Spring Security の HeaderWriter 群が走った後）に上書きする
        if (!isStatus2xx(res.getStatus())) {
            // 4xx / 5xx エラーは対象パスでも no-cache のまま（Spring Security デフォルトに任せる）
            return;
        }

        // GET 以外は対象外
        if (!"GET".equals(req.getMethod())) {
            return;
        }

        String path = req.getRequestURI();
        Optional<CacheableRule> matched = CACHEABLE_RULES.stream()
                .filter(rule -> rule.pathPattern().matcher(path).matches())
                .findFirst();

        // [TEMP DEBUG Issue#127]
        System.err.println("[Issue#127-FILTER] matched=" + matched.isPresent()
                + " isControllerSet=" + isControllerSetCacheControl(res)
                + " URI=" + req.getRequestURI()
                + " ServletPath=" + req.getServletPath());

        if (matched.isPresent() && !isControllerSetCacheControl(res)) {
            // 対象 API + 2xx 成功 + controller が独自 Cache-Control を設定していない: 上書き
            res.setHeader(HttpHeaders.CACHE_CONTROL,
                    "public, max-age=" + matched.get().maxAgeSeconds());
            // Pragma / Expires は空文字に上書き（CloudFront キャッシュ阻害回避）
            res.setHeader(HttpHeaders.PRAGMA, "");
            res.setHeader(HttpHeaders.EXPIRES, "");
            System.err.println("[Issue#127-FILTER] OVERRIDE applied. Final Cache-Control="
                    + res.getHeader("Cache-Control"));
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
