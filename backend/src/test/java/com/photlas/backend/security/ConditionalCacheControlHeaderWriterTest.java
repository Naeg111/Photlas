package com.photlas.backend.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#127: ConditionalCacheControlHeaderWriter のテスト
 *
 * パスごとの個別 TTL（60s/300s/3600s）でキャッシュ可能化される対象パス、
 * および対象外（POST, /me, /photos/{id} 等）が従来どおり no-cache に
 * 落ちることを検証する。
 *
 * 本 Filter は chain.doFilter 前に対象パス判定 + Cache-Control 設定を行う。
 * テストでは Spring Security のデフォルト動作（containsHeader をチェックして
 * 未セットなら no-cache を付与）を模擬する chain を使う。これにより
 * 「本 Filter が forward direction で先にセットした値が、Spring Security
 * デフォルトの上書きをスキップさせる」という production 動作を再現する。
 */
class ConditionalCacheControlHeaderWriterTest {

    private final ConditionalCacheControlHeaderWriter writer = new ConditionalCacheControlHeaderWriter();

    // ============================================================
    // (a)〜(h) キャッシュ対象パスごとの TTL
    // ============================================================

    @Test
    @DisplayName("Issue#127 (a) - GET /api/v1/spots は max-age=60 でキャッシュ可能化（Pragma/Expires は空に上書き）")
    void spotsGet200ShouldBeCacheable60() throws Exception {
        MockHttpServletResponse res = invokeForGet("/api/v1/spots", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=60");
        assertThat(res.getHeader(HttpHeaders.PRAGMA)).isEqualTo("");
        assertThat(res.getHeader(HttpHeaders.EXPIRES)).isEqualTo("");
    }

    @Test
    @DisplayName("Issue#127 (b) - GET /api/v1/categories は max-age=300 でキャッシュ可能化")
    void categoriesGet200ShouldBeCacheable300() throws Exception {
        MockHttpServletResponse res = invokeForGet("/api/v1/categories", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=300");
        assertThat(res.getHeader(HttpHeaders.PRAGMA)).isEqualTo("");
        assertThat(res.getHeader(HttpHeaders.EXPIRES)).isEqualTo("");
    }

    @Test
    @DisplayName("Issue#127 (c) - GET /api/v1/ogp/photo/{id} は max-age=300 でキャッシュ可能化")
    void ogpPhotoGet200ShouldBeCacheable300() throws Exception {
        MockHttpServletResponse res = invokeForGet("/api/v1/ogp/photo/123", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=300");
        assertThat(res.getHeader(HttpHeaders.PRAGMA)).isEqualTo("");
        assertThat(res.getHeader(HttpHeaders.EXPIRES)).isEqualTo("");
    }

    @Test
    @DisplayName("Issue#127 (d) - GET /api/v1/sitemap.xml は max-age=3600 でキャッシュ可能化")
    void sitemapIndexGet200ShouldBeCacheable3600() throws Exception {
        MockHttpServletResponse res = invokeForGet("/api/v1/sitemap.xml", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=3600");
        assertThat(res.getHeader(HttpHeaders.PRAGMA)).isEqualTo("");
        assertThat(res.getHeader(HttpHeaders.EXPIRES)).isEqualTo("");
    }

    @Test
    @DisplayName("Issue#127 (e) - GET /api/v1/sitemap-static.xml は max-age=3600 でキャッシュ可能化")
    void sitemapStaticGet200ShouldBeCacheable3600() throws Exception {
        MockHttpServletResponse res = invokeForGet("/api/v1/sitemap-static.xml", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=3600");
    }

    @Test
    @DisplayName("Issue#127 (f) - GET /api/v1/sitemap-photos-{n}.xml は max-age=3600 でキャッシュ可能化")
    void sitemapPhotosGet200ShouldBeCacheable3600() throws Exception {
        MockHttpServletResponse res = invokeForGet("/api/v1/sitemap-photos-0.xml", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=3600");
    }

    @Test
    @DisplayName("Issue#127 (g) - GET /api/v1/users/{userId} は max-age=60 でキャッシュ可能化")
    void usersByIdGet200ShouldBeCacheable60() throws Exception {
        MockHttpServletResponse res = invokeForGet("/api/v1/users/123", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=60");
    }

    @Test
    @DisplayName("Issue#127 (h) - GET /api/v1/users/{userId}/photos は max-age=60 でキャッシュ可能化")
    void usersByIdPhotosGet200ShouldBeCacheable60() throws Exception {
        MockHttpServletResponse res = invokeForGet("/api/v1/users/123/photos", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=60");
    }

    // ============================================================
    // (i)〜(m) キャッシュしない（no-cache のまま）
    // ============================================================

    @Test
    @DisplayName("Issue#127 (i) - 対象パスで 4xx エラーになっても Cache-Control は max-age=60（forward direction で status 不明のため設定済み）")
    void spotsGet400StillCacheable() throws Exception {
        MockHttpServletResponse res = invokeForGet("/api/v1/spots", 400);

        // forward direction で先に設定するため status とは関係なく max-age=60 になる。
        // CloudFront は 4xx に対して ErrorCachingMinTTL（デフォルト 10s）でキャッシュ
        // するため、ブラウザ側は 60s だが CDN 側は 10s で短期キャッシュとなる
        // （実害なし、仕様として許容）。
        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=60");
    }

    @Test
    @DisplayName("Issue#127 (j) - 対象パスでも GET 以外（POST 等）は Spring Security デフォルトのまま")
    void spotsPostShouldRemainNoCache() throws Exception {
        MockHttpServletRequest req = buildRequest("POST", "/api/v1/spots/photos");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(req, res, 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL))
                .isEqualTo("no-cache, no-store, max-age=0, must-revalidate");
    }

    @Test
    @DisplayName("Issue#127 (k) - 対象外パス /api/v1/photos/{id} は Spring Security デフォルトのまま")
    void photosByIdShouldNotBeCacheable() throws Exception {
        MockHttpServletResponse res = invokeForGet("/api/v1/photos/123", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL))
                .isEqualTo("no-cache, no-store, max-age=0, must-revalidate");
    }

    @Test
    @DisplayName("Issue#127 (l) - /api/v1/users/me は \\d+ にマッチせず no-cache のまま（個人情報のため意図的除外）")
    void usersMeShouldNotBeCacheable() throws Exception {
        MockHttpServletResponse res = invokeForGet("/api/v1/users/me", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL))
                .isEqualTo("no-cache, no-store, max-age=0, must-revalidate");
    }

    @Test
    @DisplayName("Issue#127 (m) - /api/v1/users/me/photos も同様に no-cache のまま")
    void usersMePhotosShouldNotBeCacheable() throws Exception {
        MockHttpServletResponse res = invokeForGet("/api/v1/users/me/photos", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL))
                .isEqualTo("no-cache, no-store, max-age=0, must-revalidate");
    }

    // ============================================================
    // (n) controller が独自に Cache-Control を設定済みの場合は上書きしない
    // ============================================================

    @Test
    @DisplayName("Issue#127 (n) - controller が後から Cache-Control を上書きすればその値が勝つ（forward direction setHeader は replace 仕様）")
    void controllerCanOverrideCacheControl() throws Exception {
        MockHttpServletRequest req = buildRequest("GET", "/api/v1/spots");
        MockHttpServletResponse res = new MockHttpServletResponse();
        // controller が ResponseEntity.cacheControl(...) で no-store を独自設定するケースを想定
        FilterChain chain = (request, response) -> {
            MockHttpServletResponse r = (MockHttpServletResponse) response;
            r.setStatus(200);
            r.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        };
        writer.doFilter(req, res, chain);

        // controller の setHeader が後勝ちで no-store になる
        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store");
    }

    // ============================================================
    // ヘルパー
    // ============================================================

    private MockHttpServletResponse invokeForGet(String uri, int status) throws Exception {
        MockHttpServletRequest req = buildRequest("GET", uri);
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(req, res, status);
        return res;
    }

    /**
     * Filter を呼び出すヘルパー。
     * chain 内で Spring Security デフォルトの動作を模擬する: containsHeader を
     * チェックして未セットならば no-cache 系を付与する（実際の
     * CacheControlHeadersWriter と同じ動作）。これにより本 Filter が forward
     * direction で先に設定した値が尊重される production 挙動を再現する。
     */
    private void invokeFilter(MockHttpServletRequest req, MockHttpServletResponse res, int status) throws Exception {
        FilterChain chain = (request, response) -> {
            MockHttpServletResponse r = (MockHttpServletResponse) response;
            r.setStatus(status);
            // Spring Security デフォルトを模擬: 各ヘッダ独立に「未セットなら付与」
            if (!r.containsHeader(HttpHeaders.CACHE_CONTROL)) {
                r.setHeader(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, max-age=0, must-revalidate");
            }
            if (!r.containsHeader(HttpHeaders.PRAGMA)) {
                r.setHeader(HttpHeaders.PRAGMA, "no-cache");
            }
            if (!r.containsHeader(HttpHeaders.EXPIRES)) {
                r.setHeader(HttpHeaders.EXPIRES, "0");
            }
        };
        writer.doFilter(req, res, chain);
    }

    /**
     * MockHttpServletRequest を作成する。
     *
     * <p>注: AntPathRequestMatcher / RegexRequestMatcher はそれぞれ内部で
     * {@code request.getServletPath()} と {@code request.getRequestURI()} を見る。
     * Spring Boot の本番環境（context-path = ""）では両者とも同じ値になるため、
     * テストでも同じ値を両方に明示的にセットする。</p>
     */
    private static MockHttpServletRequest buildRequest(String method, String uri) {
        MockHttpServletRequest req = new MockHttpServletRequest(method, uri);
        req.setServletPath(uri);
        return req;
    }
}
