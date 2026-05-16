package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.TagRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeFormatter;

/**
 * Issue#54: サイトマップインデックス方式生成コントローラー
 * 検索エンジン向けにXML形式のサイトマップを返す
 */
@RestController
public class SitemapController {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final int PHOTOS_PER_SITEMAP = 10_000;

    @Value("${app.frontend-url:https://photlas.jp}")
    private String frontendUrl;

    @Value("${app.backend-url:https://api.photlas.jp}")
    private String backendUrl;

    /** Issue#135: キーワードランディングページのサポート言語。 */
    private static final java.util.List<String> TAG_PAGE_SUPPORTED_LANGS =
            java.util.List.of("en", "ja", "zh", "ko", "es");

    private final PhotoRepository photoRepository;
    private final TagRepository tagRepository;

    public SitemapController(PhotoRepository photoRepository, TagRepository tagRepository) {
        this.photoRepository = photoRepository;
        this.tagRepository = tagRepository;
    }

    /**
     * サイトマップインデックスを生成する
     */
    @GetMapping(value = "/api/v1/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getSitemapIndex() {
        long totalPhotos = photoRepository.countPublishedPhotosExcludingDeletedUsers(
                CodeConstants.MODERATION_STATUS_PUBLISHED);
        int totalPages = (int) Math.ceil((double) totalPhotos / PHOTOS_PER_SITEMAP);

        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<sitemapindex xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        // 静的ページサイトマップ
        // SEO 上、サイトマップ内 URL のドメインはサイト本体のドメインに揃えるのが自然なため
        // backendUrl ではなく frontendUrl を使う（CloudFront の /api/* ビヘイビアで ALB に転送される）
        sb.append("  <sitemap>\n");
        sb.append("    <loc>").append(frontendUrl).append("/api/v1/sitemap-static.xml</loc>\n");
        sb.append("  </sitemap>\n");

        // 写真サイトマップ（ページごと）
        for (int i = 0; i < totalPages; i++) {
            sb.append("  <sitemap>\n");
            sb.append("    <loc>").append(frontendUrl).append("/api/v1/sitemap-photos-").append(i).append(".xml</loc>\n");
            sb.append("  </sitemap>\n");
        }

        // Issue#135: キーワードランディングページのサイトマップ
        sb.append("  <sitemap>\n");
        sb.append("    <loc>").append(frontendUrl).append("/api/v1/sitemap-tags.xml</loc>\n");
        sb.append("  </sitemap>\n");

        sb.append("</sitemapindex>");
        return ResponseEntity.ok(sb.toString());
    }

    /**
     * Issue#135: キーワードランディングページのサイトマップ。
     *
     * <p>{@code is_active=TRUE} のキーワード × 5 言語のすべての URL を含める
     * （写真 0 件のキーワードも含む）。</p>
     */
    @GetMapping(value = "/api/v1/sitemap-tags.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getTagsSitemap() {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        for (Tag tag : tagRepository.findAll()) {
            if (!Boolean.TRUE.equals(tag.getIsActive())) {
                continue;
            }
            for (String lang : TAG_PAGE_SUPPORTED_LANGS) {
                appendUrl(
                        sb,
                        frontendUrl + "/tags/" + tag.getSlug() + "?lang=" + lang,
                        "weekly",
                        "0.5");
            }
        }

        sb.append("</urlset>");
        return ResponseEntity.ok(sb.toString());
    }

    /**
     * 静的ページのサイトマップを生成する
     */
    @GetMapping(value = "/api/v1/sitemap-static.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getStaticSitemap() {
        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        appendUrl(sb, frontendUrl + "/", "daily", "1.0");
        // Issue#106 修正: React Router のルート定義（/terms-of-service, /privacy-policy）と一致させる。
        // 旧 URL（/terms, /privacy）はキャッチオールルートに該当して NotFoundPage が表示されるため、
        // Search Console から「ページにリダイレクトがあります」として警告されていた。
        appendUrl(sb, frontendUrl + "/terms-of-service", "monthly", "0.3");
        appendUrl(sb, frontendUrl + "/privacy-policy", "monthly", "0.3");

        sb.append("</urlset>");
        return ResponseEntity.ok(sb.toString());
    }

    /**
     * 写真サイトマップを生成する（ページネーション対応）
     */
    @GetMapping(value = "/api/v1/sitemap-photos-{page}.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getPhotosSitemap(@PathVariable int page) {
        Page<Photo> photosPage = photoRepository.findPublishedPhotosExcludingDeletedUsers(
                CodeConstants.MODERATION_STATUS_PUBLISHED,
                PageRequest.of(page, PHOTOS_PER_SITEMAP));

        if (photosPage.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        for (Photo photo : photosPage.getContent()) {
            sb.append("  <url>\n");
            sb.append("    <loc>").append(frontendUrl).append("/photo-viewer/").append(photo.getPhotoId()).append("</loc>\n");
            if (photo.getUpdatedAt() != null) {
                sb.append("    <lastmod>").append(photo.getUpdatedAt().format(DATE_FORMATTER)).append("</lastmod>\n");
            } else if (photo.getCreatedAt() != null) {
                sb.append("    <lastmod>").append(photo.getCreatedAt().format(DATE_FORMATTER)).append("</lastmod>\n");
            }
            sb.append("    <changefreq>monthly</changefreq>\n");
            sb.append("    <priority>0.8</priority>\n");
            sb.append("  </url>\n");
        }

        sb.append("</urlset>");
        return ResponseEntity.ok(sb.toString());
    }

    private void appendUrl(StringBuilder sb, String loc, String changefreq, String priority) {
        sb.append("  <url>\n");
        sb.append("    <loc>").append(loc).append("</loc>\n");
        sb.append("    <changefreq>").append(changefreq).append("</changefreq>\n");
        sb.append("    <priority>").append(priority).append("</priority>\n");
        sb.append("  </url>\n");
    }
}
