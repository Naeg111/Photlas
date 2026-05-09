package com.photlas.backend.security;

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
 * および対象外（4xx, POST, /me, /photos/{id} 等）が従来どおり no-cache に
 * 落ちることを検証する。
 */
class ConditionalCacheControlHeaderWriterTest {

    private final ConditionalCacheControlHeaderWriter writer = new ConditionalCacheControlHeaderWriter();

    // ============================================================
    // (a)〜(h) キャッシュ対象パスごとの TTL
    // ============================================================

    @Test
    @DisplayName("Issue#127 (a) - GET /api/v1/spots は max-age=60 でキャッシュ可能化")
    void spotsGet200ShouldBeCacheable60() {
        MockHttpServletResponse res = invokeForGet("/api/v1/spots", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=60");
        assertThat(res.containsHeader(HttpHeaders.PRAGMA)).isFalse();
        assertThat(res.containsHeader(HttpHeaders.EXPIRES)).isFalse();
    }

    @Test
    @DisplayName("Issue#127 (b) - GET /api/v1/categories は max-age=300 でキャッシュ可能化")
    void categoriesGet200ShouldBeCacheable300() {
        MockHttpServletResponse res = invokeForGet("/api/v1/categories", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=300");
        assertThat(res.containsHeader(HttpHeaders.PRAGMA)).isFalse();
        assertThat(res.containsHeader(HttpHeaders.EXPIRES)).isFalse();
    }

    @Test
    @DisplayName("Issue#127 (c) - GET /api/v1/ogp/photo/{id} は max-age=300 でキャッシュ可能化")
    void ogpPhotoGet200ShouldBeCacheable300() {
        MockHttpServletResponse res = invokeForGet("/api/v1/ogp/photo/123", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=300");
        assertThat(res.containsHeader(HttpHeaders.PRAGMA)).isFalse();
        assertThat(res.containsHeader(HttpHeaders.EXPIRES)).isFalse();
    }

    @Test
    @DisplayName("Issue#127 (d) - GET /api/v1/sitemap.xml は max-age=3600 でキャッシュ可能化")
    void sitemapIndexGet200ShouldBeCacheable3600() {
        MockHttpServletResponse res = invokeForGet("/api/v1/sitemap.xml", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=3600");
        assertThat(res.containsHeader(HttpHeaders.PRAGMA)).isFalse();
        assertThat(res.containsHeader(HttpHeaders.EXPIRES)).isFalse();
    }

    @Test
    @DisplayName("Issue#127 (e) - GET /api/v1/sitemap-static.xml は max-age=3600 でキャッシュ可能化")
    void sitemapStaticGet200ShouldBeCacheable3600() {
        MockHttpServletResponse res = invokeForGet("/api/v1/sitemap-static.xml", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=3600");
    }

    @Test
    @DisplayName("Issue#127 (f) - GET /api/v1/sitemap-photos-{n}.xml は max-age=3600 でキャッシュ可能化")
    void sitemapPhotosGet200ShouldBeCacheable3600() {
        MockHttpServletResponse res = invokeForGet("/api/v1/sitemap-photos-0.xml", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=3600");
    }

    @Test
    @DisplayName("Issue#127 (g) - GET /api/v1/users/{userId} は max-age=60 でキャッシュ可能化")
    void usersByIdGet200ShouldBeCacheable60() {
        MockHttpServletResponse res = invokeForGet("/api/v1/users/123", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=60");
    }

    @Test
    @DisplayName("Issue#127 (h) - GET /api/v1/users/{userId}/photos は max-age=60 でキャッシュ可能化")
    void usersByIdPhotosGet200ShouldBeCacheable60() {
        MockHttpServletResponse res = invokeForGet("/api/v1/users/123/photos", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("public, max-age=60");
    }

    // ============================================================
    // (i)〜(m) キャッシュしない（no-cache に落ちる）
    // ============================================================

    @Test
    @DisplayName("Issue#127 (i) - 対象パスでも 4xx エラーは no-cache に落ちる")
    void spotsGet400ShouldFallToNoCache() {
        MockHttpServletResponse res = invokeForGet("/api/v1/spots", 400);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL))
                .isEqualTo("no-cache, no-store, max-age=0, must-revalidate");
        assertThat(res.getHeader(HttpHeaders.PRAGMA)).isEqualTo("no-cache");
        assertThat(res.getHeader(HttpHeaders.EXPIRES)).isEqualTo("0");
    }

    @Test
    @DisplayName("Issue#127 (j) - 対象パスでも GET 以外（POST 等）は no-cache に落ちる")
    void spotsPostShouldFallToNoCache() {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/v1/spots/photos");
        MockHttpServletResponse res = new MockHttpServletResponse();
        res.setStatus(200);

        writer.writeHeaders(req, res);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL))
                .isEqualTo("no-cache, no-store, max-age=0, must-revalidate");
    }

    @Test
    @DisplayName("Issue#127 (k) - 対象外パス /api/v1/photos/{id} は no-cache")
    void photosByIdShouldNotBeCacheable() {
        MockHttpServletResponse res = invokeForGet("/api/v1/photos/123", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL))
                .isEqualTo("no-cache, no-store, max-age=0, must-revalidate");
    }

    @Test
    @DisplayName("Issue#127 (l) - /api/v1/users/me は \\d+ にマッチせず no-cache（個人情報を含むため意図的除外）")
    void usersMeShouldNotBeCacheable() {
        MockHttpServletResponse res = invokeForGet("/api/v1/users/me", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL))
                .isEqualTo("no-cache, no-store, max-age=0, must-revalidate");
    }

    @Test
    @DisplayName("Issue#127 (m) - /api/v1/users/me/photos も同様に no-cache")
    void usersMePhotosShouldNotBeCacheable() {
        MockHttpServletResponse res = invokeForGet("/api/v1/users/me/photos", 200);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL))
                .isEqualTo("no-cache, no-store, max-age=0, must-revalidate");
    }

    // ============================================================
    // (n) 既設 Cache-Control の尊重
    // ============================================================

    @Test
    @DisplayName("Issue#127 (n) - controller が既に Cache-Control をセットしている場合は上書きしない（ViewportBounceController 互換）")
    void shouldNotOverrideExistingCacheControl() {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/v1/spots");
        MockHttpServletResponse res = new MockHttpServletResponse();
        res.setStatus(200);
        // controller が ResponseEntity.cacheControl(...) で no-store を設定済みのケースを想定
        res.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");

        writer.writeHeaders(req, res);

        assertThat(res.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store");
    }

    // ============================================================
    // ヘルパー
    // ============================================================

    private MockHttpServletResponse invokeForGet(String uri, int status) {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", uri);
        MockHttpServletResponse res = new MockHttpServletResponse();
        res.setStatus(status);
        writer.writeHeaders(req, res);
        return res;
    }
}
