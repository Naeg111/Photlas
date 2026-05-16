package com.photlas.backend.controller;

import com.photlas.backend.dto.TagDisplay;
import com.photlas.backend.repository.PhotoTagRepository;
import com.photlas.backend.service.TagService;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.view.RedirectView;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Issue#135 Phase 13: キーワードランディングページ (Thymeleaf SSR)。
 *
 * <p>{@code GET /tags/{slug}?lang={lang}}</p>
 *
 * <ul>
 *   <li>lang 未指定なら ?lang=en へ 301 リダイレクト（デフォルト英語）</li>
 *   <li>slug が存在しない / is_active=FALSE なら 404</li>
 *   <li>5 言語の hreflang メタタグを出力</li>
 *   <li>48 枚ページネーション</li>
 *   <li>0 件キーワードの案内 + 関連キーワード（未実装は将来）</li>
 * </ul>
 */
@Controller
@RequestMapping("/tags")
public class TagPageController {

    /** 1 ページあたりの写真件数 (Issue#135 3.6)。 */
    private static final int PAGE_SIZE = 48;

    /** デフォルト言語。 */
    private static final String DEFAULT_LANG = "en";

    /** サポート言語の ISO コード。 */
    private static final List<String> SUPPORTED_LANGS = List.of("en", "ja", "zh", "ko", "es");

    private final TagService tagService;
    private final PhotoTagRepository photoTagRepository;

    public TagPageController(TagService tagService, PhotoTagRepository photoTagRepository) {
        this.tagService = tagService;
        this.photoTagRepository = photoTagRepository;
    }

    @GetMapping("/{slug}")
    public Object showTagPage(
            @PathVariable String slug,
            @RequestParam(name = "lang", required = false) String lang,
            @RequestParam(name = "page", required = false, defaultValue = "1") int page,
            Model model) {

        // Issue#135 3.6: lang 未指定なら ?lang=en へ 301 リダイレクト
        if (lang == null || lang.isBlank()) {
            String encodedSlug = URLEncoder.encode(slug, StandardCharsets.UTF_8);
            RedirectView redirect = new RedirectView("/tags/" + encodedSlug + "?lang=" + DEFAULT_LANG);
            redirect.setStatusCode(HttpStatus.MOVED_PERMANENTLY);
            return redirect;
        }

        // is_active=TRUE のタグだけ表示。それ以外は 404 (Issue#135 3.6)
        Optional<TagDisplay> tagOpt = tagService.findActiveBySlugForDisplay(slug, lang);
        TagDisplay tag = tagOpt.orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "tag not found or inactive: " + slug));

        long photoCount = photoTagRepository.countByTagId(tag.tagId());

        model.addAttribute("tag", tag);
        model.addAttribute("lang", lang);
        model.addAttribute("photoCount", photoCount);
        model.addAttribute("hreflangs", buildHreflangs(slug));
        model.addAttribute("canonicalUrl", canonicalUrlFor(slug, lang));
        // Phase 1 では photos の詳細グリッドは省略。将来追加予定。
        model.addAttribute("photos", List.of());
        model.addAttribute("currentPage", page);
        model.addAttribute("pageSize", PAGE_SIZE);

        return "tag-page";
    }

    /** 5 言語 + x-default の {@code Map<lang, url>} を構築。 */
    private Map<String, String> buildHreflangs(String slug) {
        java.util.LinkedHashMap<String, String> map = new java.util.LinkedHashMap<>();
        for (String l : SUPPORTED_LANGS) {
            map.put(l, canonicalUrlFor(slug, l));
        }
        map.put("x-default", canonicalUrlFor(slug, DEFAULT_LANG));
        return map;
    }

    /** canonical URL を組み立てる（ホスト名は将来環境変数化）。 */
    private String canonicalUrlFor(String slug, String lang) {
        return "/tags/" + URLEncoder.encode(slug, StandardCharsets.UTF_8) + "?lang=" + lang;
    }
}
