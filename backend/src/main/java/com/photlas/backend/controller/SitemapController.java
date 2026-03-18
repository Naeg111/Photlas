package com.photlas.backend.controller;

import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.repository.PhotoRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * サイトマップ生成コントローラー
 * 検索エンジン向けにXML形式のサイトマップを返す
 */
@RestController
public class SitemapController {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Value("${app.frontend-url:https://photlas.jp}")
    private String frontendUrl;

    private final PhotoRepository photoRepository;

    public SitemapController(PhotoRepository photoRepository) {
        this.photoRepository = photoRepository;
    }

    /**
     * XMLサイトマップを生成する
     *
     * @return XML形式のサイトマップ
     */
    @GetMapping(value = "/api/v1/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> getSitemap() {
        List<Photo> photos = photoRepository.findByModerationStatus(ModerationStatus.PUBLISHED);

        StringBuilder sb = new StringBuilder();
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        sb.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        // トップページ
        sb.append("  <url>\n");
        sb.append("    <loc>").append(frontendUrl).append("/</loc>\n");
        sb.append("    <changefreq>daily</changefreq>\n");
        sb.append("    <priority>1.0</priority>\n");
        sb.append("  </url>\n");

        // 各写真ページ
        for (Photo photo : photos) {
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
}
