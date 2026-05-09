package com.photlas.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.web.header.HeaderWriter;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.RegexRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

import java.util.List;
import java.util.Optional;

/**
 * Issue#127: パスごとに Cache-Control を出し分ける Spring Security HeaderWriter。
 *
 * <p>対象 8 系統の公開 GET エンドポイントは {@code Cache-Control: public, max-age=<TTL>}
 * を返し、それ以外は従来の Spring Security デフォルトと同じ完全 no-cache を返す。
 * これにより CloudFront `/api/*` Behavior（{@code Managed-CachingOptimized}）と組み合わせて
 * 対象 API のみを CDN キャッシュ可能化する。</p>
 *
 * <p>本クラスは {@link org.springframework.security.web.header.writers.CacheControlHeadersWriter}
 * を置き換えて利用することを想定している（{@code SecurityConfig} で
 * {@code headers().cacheControl(c -> c.disable()).addHeaderWriter(...)} で登録）。</p>
 *
 * <p>依存を持たないため、{@code @Component} ではなく {@code SecurityConfig} 内で
 * 直接 {@code new} する。これは {@code @WebMvcTest} で
 * {@code @Import(SecurityConfig.class)} する既存テスト
 * （HealthControllerTest 等）が {@code @Component} を自動 scan しない制約に対応するため。</p>
 */
public class ConditionalCacheControlHeaderWriter implements HeaderWriter {

    /**
     * 対象パスごとに TTL（秒）を持たせるためのレコード。
     * 先頭から評価し最初にマッチしたものを採用する。
     */
    private record CacheableRule(RequestMatcher matcher, int maxAgeSeconds) {}

    // AntPathRequestMatcher は path 内の {var} で正規表現制約を表現できないため、
    // 数値 userId に厳密マッチさせたい /users/\d+ 系は RegexRequestMatcher を使う
    // （SecurityConfig が同じパターンを使っているので整合する）。
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
    public void writeHeaders(HttpServletRequest req, HttpServletResponse res) {
        if (!isStatus2xx(res.getStatus())) {
            // 4xx / 5xx エラーは対象パスでも no-cache（誤情報のキャッシュを防ぐ）
            applyNoCacheHeaders(res);
            return;
        }

        Optional<CacheableRule> matched = CACHEABLE_RULES.stream()
                .filter(rule -> rule.matcher().matches(req))
                .findFirst();

        if (matched.isPresent()) {
            // 対象 API + 2xx 成功: 個別 TTL でキャッシュ可能化。
            // Pragma / Expires は出さない（CloudFront は Pragma: no-cache 残存時に
            // Cache-Control の指示と関係なくキャッシュをスキップするため）。
            // controller が ResponseEntity.cacheControl(...) で明示している場合は尊重。
            if (!res.containsHeader(HttpHeaders.CACHE_CONTROL)) {
                res.setHeader(HttpHeaders.CACHE_CONTROL,
                        "public, max-age=" + matched.get().maxAgeSeconds());
            }
        } else {
            // それ以外（対象外パス）: 従来の Spring Security デフォルトと同じ完全 no-cache
            applyNoCacheHeaders(res);
        }
    }

    /**
     * 各ヘッダ独立に「未セットなら付与」する。
     * controller 側で Cache-Control: no-store を設定している場合（ViewportBounceController 等）
     * は尊重し、Pragma / Expires のみ補完される。
     */
    private static void applyNoCacheHeaders(HttpServletResponse res) {
        if (!res.containsHeader(HttpHeaders.CACHE_CONTROL)) {
            res.setHeader(HttpHeaders.CACHE_CONTROL,
                    "no-cache, no-store, max-age=0, must-revalidate");
        }
        if (!res.containsHeader(HttpHeaders.PRAGMA)) {
            res.setHeader(HttpHeaders.PRAGMA, "no-cache");
        }
        if (!res.containsHeader(HttpHeaders.EXPIRES)) {
            res.setHeader(HttpHeaders.EXPIRES, "0");
        }
    }

    private static boolean isStatus2xx(int status) {
        return status >= 200 && status < 300;
    }
}
