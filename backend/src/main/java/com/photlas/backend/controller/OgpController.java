package com.photlas.backend.controller;

import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.S3Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * OGPメタタグ生成コントローラー
 * SNSクローラー向けに写真のOGPメタタグ入りHTMLを返す
 */
@RestController
@RequestMapping("/api/v1/ogp")
public class OgpController {

    private static final String SITE_NAME = "Photlas";
    private static final String JSON_PROP_SEPARATOR = "\",\n";

    @Value("${app.frontend-url:https://photlas.jp}")
    private String frontendUrl;

    private final PhotoRepository photoRepository;
    private final SpotRepository spotRepository;
    private final UserRepository userRepository;
    private final S3Service s3Service;

    public OgpController(PhotoRepository photoRepository, SpotRepository spotRepository,
                         UserRepository userRepository, S3Service s3Service) {
        this.photoRepository = photoRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.s3Service = s3Service;
    }

    /**
     * 写真のOGPメタタグ入りHTMLを返す
     *
     * @param photoId 写真ID
     * @return OGPメタタグを含むHTML
     */
    @GetMapping(value = "/photo/{photoId}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> getPhotoOgp(@PathVariable Long photoId) {
        Optional<Photo> photoOpt = photoRepository.findById(photoId);
        if (photoOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Photo photo = photoOpt.get();

        // Issue#54: 非公開写真のOGPは404を返す
        if (photo.getModerationStatus() != ModerationStatus.PUBLISHED) {
            return ResponseEntity.notFound().build();
        }

        // OGPクローラー向けにサムネイルURLを使用（元画像は数十MBになりクローラーがタイムアウトするため）
        String thumbnailUrl = s3Service.generateThumbnailCdnUrl(photo.getS3ObjectKey());
        String imageUrl = thumbnailUrl != null ? thumbnailUrl : s3Service.generateCdnUrl(photo.getS3ObjectKey());
        String displayTitle = photo.getPlaceName() != null
                ? photo.getPlaceName() + " - " + SITE_NAME
                : SITE_NAME;
        String pageUrl = frontendUrl + "/photo-viewer/" + photoId;

        // ユーザー名を取得
        String username = SITE_NAME;
        Optional<User> userOpt = userRepository.findById(photo.getUserId());
        if (userOpt.isPresent()) {
            username = userOpt.get().getUsername();
        }

        String jsonLdTitle = photo.getPlaceName() != null ? photo.getPlaceName() : SITE_NAME;
        String description = username + "さんが撮影した写真 - " + SITE_NAME;

        // スポット情報を取得（JSON-LD用）
        String jsonLd = buildJsonLd(photo, jsonLdTitle, imageUrl, username, pageUrl);

        String html = buildOgpHtml(displayTitle, description, imageUrl, pageUrl, jsonLd);
        return ResponseEntity.ok(html);
    }

    private String buildJsonLd(Photo photo, String title, String imageUrl, String username, String pageUrl) {
        StringBuilder sb = new StringBuilder();
        sb.append("{\n");
        sb.append("  \"@context\": \"https://schema.org\",\n");
        sb.append("  \"@type\": \"Photograph\",\n");
        sb.append("  \"name\": \"").append(escapeJson(title)).append(JSON_PROP_SEPARATOR);
        sb.append("  \"image\": \"").append(escapeJson(imageUrl)).append(JSON_PROP_SEPARATOR);
        sb.append("  \"url\": \"").append(escapeJson(pageUrl)).append(JSON_PROP_SEPARATOR);
        sb.append("  \"author\": {\n");
        sb.append("    \"@type\": \"Person\",\n");
        sb.append("    \"name\": \"").append(escapeJson(username)).append("\"\n");
        sb.append("  }");

        if (photo.getCreatedAt() != null) {
            sb.append(",\n  \"datePublished\": \"").append(photo.getCreatedAt().toString()).append("\"");
        }

        // 位置情報
        Optional<Spot> spotOpt = spotRepository.findById(photo.getSpotId());
        if (spotOpt.isPresent()) {
            Spot spot = spotOpt.get();
            sb.append(",\n  \"contentLocation\": {\n");
            sb.append("    \"@type\": \"Place\",\n");
            sb.append("    \"geo\": {\n");
            sb.append("      \"@type\": \"GeoCoordinates\",\n");
            sb.append("      \"latitude\": ").append(spot.getLatitude()).append(",\n");
            sb.append("      \"longitude\": ").append(spot.getLongitude()).append("\n");
            sb.append("    }\n");
            sb.append("  }");
        }

        sb.append("\n}");
        return sb.toString();
    }

    private String buildOgpHtml(String title, String description, String imageUrl, String pageUrl, String jsonLd) {
        return "<!DOCTYPE html>\n"
                + "<html lang=\"ja\">\n"
                + "<head>\n"
                + "  <meta charset=\"UTF-8\" />\n"
                + "  <title>" + escapeHtml(title) + "</title>\n"
                + "  <meta name=\"description\" content=\"" + escapeHtml(description) + "\" />\n"
                + "  <meta property=\"og:title\" content=\"" + escapeHtml(title) + "\" />\n"
                + "  <meta property=\"og:description\" content=\"" + escapeHtml(description) + "\" />\n"
                + "  <meta property=\"og:image\" content=\"" + escapeHtml(imageUrl) + "\" />\n"
                + "  <meta property=\"og:type\" content=\"article\" />\n"
                + "  <meta property=\"og:url\" content=\"" + escapeHtml(pageUrl) + "\" />\n"
                + "  <meta property=\"og:site_name\" content=\"" + SITE_NAME + "\" />\n"
                + "  <meta property=\"og:locale\" content=\"ja_JP\" />\n"
                + "  <meta name=\"twitter:card\" content=\"summary_large_image\" />\n"
                + "  <meta name=\"twitter:title\" content=\"" + escapeHtml(title) + "\" />\n"
                + "  <meta name=\"twitter:description\" content=\"" + escapeHtml(description) + "\" />\n"
                + "  <meta name=\"twitter:image\" content=\"" + escapeHtml(imageUrl) + "\" />\n"
                + "  <script type=\"application/ld+json\">\n"
                + jsonLd + "\n"
                + "  </script>\n"
                + "  <meta http-equiv=\"refresh\" content=\"0;url=" + escapeHtml(pageUrl) + "\" />\n"
                + "</head>\n"
                + "<body>\n"
                + "  <p>リダイレクト中... <a href=\"" + escapeHtml(pageUrl) + "\">こちらをクリック</a></p>\n"
                + "</body>\n"
                + "</html>";
    }

    private String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}
