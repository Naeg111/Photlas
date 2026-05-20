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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
            if (meta.isPresent()) {
                html = injectOgp(html, meta.get());
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

    /** index.html の汎用 OGP/Twitter/description を写真個別の値に置換する。 */
    private String injectOgp(String html, PhotoOgpMeta m) {
        html = replaceMetaContent(html, "name", "description", m.description());
        html = replaceMetaContent(html, "property", "og:title", m.title());
        html = replaceMetaContent(html, "property", "og:description", m.description());
        html = replaceMetaContent(html, "property", "og:url", m.pageUrl());
        html = replaceMetaContent(html, "property", "og:image", m.imageUrl());
        html = replaceMetaContent(html, "property", "og:type", "article");
        html = replaceMetaContent(html, "name", "twitter:card", "summary_large_image");
        html = replaceMetaContent(html, "name", "twitter:title", m.title());
        html = replaceMetaContent(html, "name", "twitter:description", m.description());
        html = replaceMetaContent(html, "name", "twitter:image", m.imageUrl());
        return html;
    }

    /**
     * {@code <meta (property|name)="ATTR" content="...">} の content を差し替える（最初の 1 件）。
     * 該当 meta が無ければ html をそのまま返す。
     */
    private static String replaceMetaContent(String html, String attrType, String attrName, String content) {
        Pattern pattern = Pattern.compile(
                "(<meta\\s+" + attrType + "=\"" + Pattern.quote(attrName) + "\"\\s+content=\")[^\"]*(\")");
        Matcher matcher = pattern.matcher(html);
        if (matcher.find()) {
            String replacement = "$1" + Matcher.quoteReplacement(escapeHtmlAttr(content)) + "$2";
            return matcher.replaceFirst(replacement);
        }
        return html;
    }

    private static String escapeHtmlAttr(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    /** index.html を取得できなかった場合の縮退フォールバック（フロント配信障害時のみ）。 */
    private String minimalFallback() {
        return "<!DOCTYPE html><html lang=\"ja\"><head><meta charset=\"UTF-8\" />"
                + "<meta property=\"og:title\" content=\"Photlas\" />"
                + "<meta property=\"og:image\" content=\"" + frontendUrl + "/og-image.png\" />"
                + "</head><body><p><a href=\"" + frontendUrl + "/\">Photlas</a></p></body></html>";
    }
}
