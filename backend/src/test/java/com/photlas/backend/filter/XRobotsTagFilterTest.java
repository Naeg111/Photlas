package com.photlas.backend.filter;

import jakarta.servlet.ServletException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#136 §9 / #58 §6: {@link XRobotsTagFilter} のテスト。
 *
 * <p>本番（{@code app.frontend-url=https://photlas.jp}）では SEO 対象の SSR ページ
 * （{@code /tags/**}・{@code /photo-viewer/**}）に {@code X-Robots-Tag: noindex} を付けない。
 * それ以外のパス（{@code /api/*}・{@code /robots.txt} 等）と、ステージング全体（Issue#143）は
 * 従来どおり {@code noindex, nofollow} を維持する。</p>
 */
class XRobotsTagFilterTest {

    private static final String HEADER = "X-Robots-Tag";
    private static final String NOINDEX = "noindex, nofollow";
    private static final String PROD = "https://photlas.jp";
    private static final String STAGING = "https://test.photlas.jp";

    /** 指定の frontend-url・URI でフィルタを通し、付与された X-Robots-Tag を返す（無ければ null）。 */
    private String headerFor(String frontendUrl, String uri) throws ServletException, IOException {
        XRobotsTagFilter filter = new XRobotsTagFilter(frontendUrl);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response.getHeader(HEADER);
    }

    @Test
    @DisplayName("Issue#136 §9 - 本番の /tags/{slug} には noindex を付けない")
    void prodTagsHasNoNoindex() throws Exception {
        assertThat(headerFor(PROD, "/tags/mountain")).isNull();
    }

    @Test
    @DisplayName("Issue#58 §6 - 本番の /photo-viewer/{id} には noindex を付けない")
    void prodPhotoViewerHasNoNoindex() throws Exception {
        assertThat(headerFor(PROD, "/photo-viewer/1")).isNull();
    }

    @Test
    @DisplayName("Issue#136 §9 - 本番の /api/* は従来どおり noindex を付与")
    void prodApiKeepsNoindex() throws Exception {
        assertThat(headerFor(PROD, "/api/v1/spots")).isEqualTo(NOINDEX);
    }

    @Test
    @DisplayName("本番の /robots.txt は従来どおり noindex を付与")
    void prodRobotsTxtKeepsNoindex() throws Exception {
        assertThat(headerFor(PROD, "/robots.txt")).isEqualTo(NOINDEX);
    }

    @Test
    @DisplayName("Issue#143 - ステージングは /tags も含め全レスポンスで noindex を維持")
    void stagingTagsKeepsNoindex() throws Exception {
        assertThat(headerFor(STAGING, "/tags/mountain")).isEqualTo(NOINDEX);
    }

    @Test
    @DisplayName("Issue#143 - ステージングの /photo-viewer も noindex を維持")
    void stagingPhotoViewerKeepsNoindex() throws Exception {
        assertThat(headerFor(STAGING, "/photo-viewer/1")).isEqualTo(NOINDEX);
    }
}
