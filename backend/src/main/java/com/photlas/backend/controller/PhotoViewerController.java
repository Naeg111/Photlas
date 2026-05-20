package com.photlas.backend.controller;

import com.photlas.backend.dto.PhotoOgpMeta;
import com.photlas.backend.service.IndexHtmlProvider;
import com.photlas.backend.service.PhotoOgpService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Optional;

/**
 * Issue#58 §6 (B2): {@code GET /photo-viewer/{id}}。
 *
 * <p>UA 判定はせず、**全員に同じ HTML** を返す: 現行 SPA の {@code index.html} に
 * 写真個別の OGP を差し込んだもの。人間はそのまま SPA が起動して写真が開き（リダイレクト無し）、
 * クローラ（JS 非実行）は個別 OGP を読む。Googlebot は実ページ＋個別 OGP でインデックスも維持。</p>
 *
 * <p>写真が存在しない/非公開/退会オーナーの場合は **汎用 OGP のまま index.html を 200 で返す**
 * （SPA 側が「写真が見つかりません」を表示。現状の挙動を維持・無回帰）。</p>
 */
@Controller
public class PhotoViewerController {

    private final IndexHtmlProvider indexHtmlProvider;
    private final PhotoOgpService photoOgpService;
    private final String frontendUrl;

    public PhotoViewerController(
            IndexHtmlProvider indexHtmlProvider,
            PhotoOgpService photoOgpService,
            @Value("${app.frontend-url}") String frontendUrl) {
        this.indexHtmlProvider = indexHtmlProvider;
        this.photoOgpService = photoOgpService;
        this.frontendUrl = frontendUrl;
    }

    @GetMapping(value = "/photo-viewer/{id}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> photoViewer(@PathVariable String id) {
        String html = indexHtmlProvider.fetch();
        if (html == null) {
            return ResponseEntity.ok(minimalFallback());
        }
        Long photoId = parseLongOrNull(id);
        if (photoId != null) {
            Optional<PhotoOgpMeta> meta = photoOgpService.buildForPhoto(photoId);
            // TODO(Green): meta があれば html に写真個別 OGP を差し込む
            if (meta.isPresent()) {
                // placeholder
            }
        }
        return ResponseEntity.ok(html);
    }

    private static Long parseLongOrNull(String s) {
        try {
            return Long.parseLong(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** index.html を取得できなかった場合の縮退フォールバック（フロント配信障害時のみ）。 */
    private String minimalFallback() {
        return "<!DOCTYPE html><html lang=\"ja\"><head><meta charset=\"UTF-8\" />"
                + "<meta property=\"og:title\" content=\"Photlas\" />"
                + "<meta property=\"og:image\" content=\"" + frontendUrl + "/og-image.png\" />"
                + "</head><body><p><a href=\"" + frontendUrl + "/\">Photlas</a></p></body></html>";
    }
}
