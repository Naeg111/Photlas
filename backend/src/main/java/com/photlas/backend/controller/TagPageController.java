package com.photlas.backend.controller;

import com.photlas.backend.config.TagPageQueryLocaleResolver;
import com.photlas.backend.dto.TagDisplay;
import com.photlas.backend.dto.TagPagePagination;
import com.photlas.backend.dto.TagPagePhotoItem;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.repository.PhotoTagRepository;
import com.photlas.backend.repository.TagRepository;
import com.photlas.backend.service.S3Service;
import com.photlas.backend.service.TagService;
import org.springframework.context.MessageSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.view.RedirectView;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Issue#135 Phase 13 + Issue#136 Phase 5: キーワードランディングページ (Thymeleaf SSR)。
 *
 * <p>{@code GET /tags/{slug}?lang={lang}&page={page}}</p>
 *
 * <ul>
 *   <li>slug が存在しない / is_active=FALSE なら 404</li>
 *   <li>page/lang を canonical に正規化し、不一致なら 1 ホップ 301（§4.2.2）
 *     <ul>
 *       <li>lang 未指定 / {@code zh-TW} / {@code en-US} / {@code fr} 等 → canonical lang</li>
 *       <li>{@code page=1} 明示 / {@code 0} / 負数 / 非数字 / 範囲外 → 無印または最終ページ</li>
 *     </ul>
 *   </li>
 *   <li>5 言語の hreflang メタタグを出力</li>
 *   <li>48 枚ページネーション（{@code created_at DESC, photo_id DESC} 決定的順）</li>
 *   <li>サムネイル URL は {@code S3Service.generateThumbnailCdnUrl} 経由</li>
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
    private final TagRepository tagRepository;
    private final PhotoTagRepository photoTagRepository;
    private final S3Service s3Service;
    private final MessageSource messageSource;

    public TagPageController(
            TagService tagService,
            TagRepository tagRepository,
            PhotoTagRepository photoTagRepository,
            S3Service s3Service,
            MessageSource messageSource) {
        this.tagService = tagService;
        this.tagRepository = tagRepository;
        this.photoTagRepository = photoTagRepository;
        this.s3Service = s3Service;
        this.messageSource = messageSource;
    }

    @GetMapping("/{slug}")
    public Object showTagPage(
            @PathVariable String slug,
            @RequestParam(name = "lang", required = false) String rawLang,
            @RequestParam(name = "page", required = false) String rawPageStr,
            Model model) {

        // §4.2.2 ステップ 1: tag 存在確認（404 を先に出してリダイレクトループを防ぐ）
        Tag tag = tagRepository.findActiveBySlug(slug).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "tag not found or inactive: " + slug));

        // §4.2.2 ステップ 2: canonical lang を決定
        String canonicalLang = TagPageQueryLocaleResolver.canonicalize(rawLang);
        if (canonicalLang == null) {
            canonicalLang = DEFAULT_LANG;
        }

        // §4.2.2 ステップ 3: totalPages を算出（0 件でも最低 1）
        long photoCount = photoTagRepository.countActivePublishedByTagId(
                tag.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED);
        int totalPages = Math.max(1, (int) Math.ceil(photoCount / (double) PAGE_SIZE));

        // §4.2.2 ステップ 4: parsedPage から canonicalPage を決める
        Integer parsedPage = parsePageOrNull(rawPageStr);
        int canonicalPage;
        if (parsedPage == null || parsedPage <= 1) {
            canonicalPage = 1;
        } else if (parsedPage > totalPages) {
            canonicalPage = totalPages;
        } else {
            canonicalPage = parsedPage;
        }

        // §4.2.2 ステップ 5: 現状 URL と canonical URL の差分判定 → 1 ホップ 301
        boolean langMismatch = !canonicalLang.equals(rawLang);
        boolean pageMismatch = (canonicalPage == 1)
                ? (rawPageStr != null)
                : (parsedPage == null || parsedPage != canonicalPage);
        if (langMismatch || pageMismatch) {
            return redirectToCanonical(slug, canonicalLang, canonicalPage);
        }

        // §4.2.2 ステップ 6: 通常レンダリング
        String displayName = tagService.pickDisplayName(tag, canonicalLang);
        TagDisplay display = new TagDisplay(tag.getId(), tag.getSlug(), displayName);

        Pageable pageable = PageRequest.of(
                canonicalPage - 1,
                PAGE_SIZE,
                Sort.by(Sort.Direction.DESC, "createdAt")
                        .and(Sort.by(Sort.Direction.DESC, "photoId")));
        Page<Photo> photoPage = tagService.findPhotosForTag(tag.getId(), pageable);
        List<TagPagePhotoItem> photos = photoPage.getContent().stream()
                .map(p -> new TagPagePhotoItem(
                        p.getPhotoId(),
                        s3Service.generateThumbnailCdnUrl(p.getS3ObjectKey())))
                .toList();

        TagPagePagination pagination = TagPagePagination.of(canonicalPage, totalPages);

        // Q15: <title> / <meta description> / og:* を MessageSource で多言語化
        Locale locale = Locale.of(canonicalLang);
        String title = messageSource.getMessage(
                "tag.page.title",
                new Object[]{displayName, canonicalPage, photoCount},
                locale);
        String description = messageSource.getMessage(
                "tag.page.description",
                new Object[]{displayName, canonicalPage, photoCount},
                locale);

        model.addAttribute("tag", display);
        model.addAttribute("lang", canonicalLang);
        model.addAttribute("photoCount", photoCount);
        model.addAttribute("hreflangs", buildHreflangs(slug));
        model.addAttribute("canonicalUrl", canonicalUrlFor(slug, canonicalLang, canonicalPage));
        model.addAttribute("photos", photos);
        model.addAttribute("currentPage", canonicalPage);
        model.addAttribute("pageSize", PAGE_SIZE);
        model.addAttribute("pagination", pagination);
        model.addAttribute("title", title);
        model.addAttribute("description", description);

        return "tag-page";
    }

    private static Integer parsePageOrNull(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private RedirectView redirectToCanonical(String slug, String canonicalLang, int canonicalPage) {
        StringBuilder url = new StringBuilder("/tags/")
                .append(URLEncoder.encode(slug, StandardCharsets.UTF_8))
                .append("?lang=").append(canonicalLang);
        if (canonicalPage > 1) {
            url.append("&page=").append(canonicalPage);
        }
        RedirectView rv = new RedirectView(url.toString());
        rv.setStatusCode(HttpStatus.MOVED_PERMANENTLY);
        return rv;
    }

    /** 5 言語 + x-default の {@code Map<lang, url>} を構築（hreflang は page 無し URL を指す）。 */
    private Map<String, String> buildHreflangs(String slug) {
        java.util.LinkedHashMap<String, String> map = new java.util.LinkedHashMap<>();
        for (String l : SUPPORTED_LANGS) {
            map.put(l, canonicalUrlFor(slug, l, 1));
        }
        map.put("x-default", canonicalUrlFor(slug, DEFAULT_LANG, 1));
        return map;
    }

    /** canonical URL を組み立てる。page=1 のときは {@code ?page=} を付けない (Q14)。 */
    private String canonicalUrlFor(String slug, String lang, int page) {
        String base = "/tags/" + URLEncoder.encode(slug, StandardCharsets.UTF_8) + "?lang=" + lang;
        return page > 1 ? base + "&page=" + page : base;
    }
}
