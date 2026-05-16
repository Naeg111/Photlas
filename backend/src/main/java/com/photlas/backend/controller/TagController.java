package com.photlas.backend.controller;

import com.photlas.backend.dto.TagListResponse;
import com.photlas.backend.service.TagService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Issue#135: キーワード REST API。
 *
 * <p>{@code GET /api/v1/tags} で全アクティブタグ + カテゴリ紐付けを返す。
 * フロントは KeywordSection （投稿フォーム・検索フィルタ）で受け取り、
 * 文脈連動表示・アコーディオン・検索 BOX で局所的に絞り込む。</p>
 */
@RestController
@RequestMapping("/api/v1/tags")
public class TagController {

    /** Issue#135 3.6 ランディングと共通: 言語未指定時のデフォルト言語。 */
    private static final String DEFAULT_LANG = "en";

    private final TagService tagService;

    public TagController(TagService tagService) {
        this.tagService = tagService;
    }

    /**
     * 全 {@code is_active=TRUE} のタグを返す（カテゴリ紐付け付き）。
     *
     * @param lang ISO 言語コード（"ja"/"en"/"zh"/"ko"/"es"）。未指定時は en
     */
    @GetMapping
    public TagListResponse listTags(
            @RequestParam(name = "lang", required = false, defaultValue = DEFAULT_LANG) String lang) {
        return new TagListResponse(tagService.listAllActiveTags(lang));
    }
}
