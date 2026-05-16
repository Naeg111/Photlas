package com.photlas.backend.controller;

import com.photlas.backend.dto.TagDisplay;
import com.photlas.backend.service.TagService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Issue#135: 写真ごとのキーワード取得 API。
 *
 * <p>写真詳細ページとキーワードランディングページの内部リンクのため、
 * 認証不要 (SecurityConfig で permitAll)。</p>
 */
@RestController
@RequestMapping("/api/v1/photos/{photoId}/tags")
public class PhotoTagsController {

    private static final String DEFAULT_LANG = "en";

    private final TagService tagService;

    public PhotoTagsController(TagService tagService) {
        this.tagService = tagService;
    }

    @GetMapping
    public PhotoTagsResponse getPhotoTags(
            @PathVariable("photoId") Long photoId,
            @RequestParam(name = "lang", required = false, defaultValue = DEFAULT_LANG) String lang) {
        return new PhotoTagsResponse(tagService.findActiveTagsForPhoto(photoId, lang));
    }

    /** {@code GET /api/v1/photos/{id}/tags} のレスポンス。 */
    public record PhotoTagsResponse(List<TagDisplay> tags) {
    }
}
