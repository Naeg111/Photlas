package com.photlas.backend.service;

import com.photlas.backend.dto.TagDisplay;
import com.photlas.backend.dto.TagListItem;
import com.photlas.backend.dto.TagSuggestion;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.PhotoTag;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.PhotoTagRepository;
import com.photlas.backend.repository.TagCategoryRepository;
import com.photlas.backend.repository.TagRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.rekognition.model.Label;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Issue#135: キーワード機能の業務ロジックを担うサービス。
 *
 * <ul>
 *   <li>Rekognition ラベルから AI 提案キーワード抽出 (直接マッチのみ、80% 閾値、最大 10 件)</li>
 *   <li>投稿時のキーワード保存 (assigned_by / ai_confidence 付き)</li>
 *   <li>文脈連動表示用の「カテゴリ → 主要キーワード上位 N 件」取得</li>
 *   <li>キーワードランディングページ用の言語別表示名解決</li>
 * </ul>
 */
@Service
public class TagService {

    private static final Logger logger = LoggerFactory.getLogger(TagService.class);

    /** Issue#119/132 と統一: 80%。 */
    private static final float CONFIDENCE_THRESHOLD = 80f;

    /** Issue#135 3.4.1: AI 提案キーワードの最大数。 */
    private static final int MAX_SUGGESTIONS = 10;

    /** デフォルト言語（フォールバックチェーンの中継）。 */
    private static final String DEFAULT_LANG = "en";

    private final TagRepository tagRepository;
    private final TagCategoryRepository tagCategoryRepository;
    private final PhotoTagRepository photoTagRepository;
    private final PhotoRepository photoRepository;

    public TagService(
            TagRepository tagRepository,
            TagCategoryRepository tagCategoryRepository,
            PhotoTagRepository photoTagRepository,
            PhotoRepository photoRepository) {
        this.tagRepository = tagRepository;
        this.tagCategoryRepository = tagCategoryRepository;
        this.photoTagRepository = photoTagRepository;
        this.photoRepository = photoRepository;
    }

    /**
     * Issue#136 Phase 4: SSR ランディングページ用にタグ別 PUBLISHED 写真を Page で返す。
     * フィルタ条件 (PUBLISHED + 退会済みユーザー除外) は {@link PhotoRepository} 側で実装済み。
     */
    @Transactional(readOnly = true)
    public Page<Photo> findPhotosForTag(Long tagId, Pageable pageable) {
        return photoRepository.findActivePublishedByTagId(
                tagId, CodeConstants.MODERATION_STATUS_PUBLISHED, pageable);
    }

    /**
     * Rekognition ラベル群から AI 提案キーワードを抽出する。
     *
     * <p>Issue#135 3.4.1 仕様:</p>
     * <ul>
     *   <li>直接マッチのみ（親フォールバックは Phase 1 では未使用）</li>
     *   <li>信頼度 {@value #CONFIDENCE_THRESHOLD}% 以上</li>
     *   <li>{@code is_active=TRUE} のタグのみ</li>
     *   <li>最大 {@value #MAX_SUGGESTIONS} 件、信頼度上位を採用</li>
     * </ul>
     */
    @Transactional(readOnly = true)
    public List<TagSuggestion> extractSuggestions(List<Label> labels) {
        if (labels == null || labels.isEmpty()) {
            return List.of();
        }
        // 信頼度 80%+ の Rekognition ラベルを抽出（高い順）
        List<Label> qualified = labels.stream()
                .filter(l -> l.confidence() != null && l.confidence() >= CONFIDENCE_THRESHOLD)
                .sorted(Comparator.comparing(Label::confidence).reversed())
                .toList();
        if (qualified.isEmpty()) {
            return List.of();
        }
        // ラベル名 → 信頼度のマップ（同名重複は最大信頼度を採用）
        Map<String, Float> labelToConfidence = new java.util.LinkedHashMap<>();
        for (Label l : qualified) {
            labelToConfidence.merge(l.name(), l.confidence(), Math::max);
        }
        // 該当するアクティブな Tag を一括取得
        List<Tag> tags = tagRepository.findActiveByRekognitionLabels(
                new ArrayList<>(labelToConfidence.keySet()));
        // TagSuggestion 化して信頼度で降順ソートしたうえで上限を適用
        return tags.stream()
                .map(t -> new TagSuggestion(
                        t.getId(), t.getSlug(),
                        pickDisplayName(t, null),
                        labelToConfidence.get(t.getRekognitionLabel())))
                .sorted(Comparator.comparing(TagSuggestion::confidence).reversed())
                .limit(MAX_SUGGESTIONS)
                .toList();
    }

    /**
     * 写真に複数キーワードを紐付ける。既存の {@code photo_tags} 行は重複登録されない。
     *
     * @param photoId       対象写真の ID
     * @param tagIds        付与するキーワード ID リスト
     * @param assignedBy    {@link PhotoTag#ASSIGNED_BY_AI} または {@link PhotoTag#ASSIGNED_BY_USER}
     * @param aiConfidence  AI 由来時のみ tag_id → 信頼度マップ。USER 由来時は空マップ可
     */
    @Transactional
    public void assignTagsToPhoto(
            Long photoId,
            List<Long> tagIds,
            String assignedBy,
            Map<Long, Double> aiConfidence) {
        if (tagIds == null || tagIds.isEmpty()) {
            return;
        }
        for (Long tagId : tagIds) {
            PhotoTag pt = new PhotoTag(photoId, tagId);
            pt.setAssignedBy(assignedBy);
            if (PhotoTag.ASSIGNED_BY_AI.equals(assignedBy)) {
                pt.setAiConfidence(aiConfidence.get(tagId));
            }
            photoTagRepository.save(pt);
        }
    }

    /**
     * 1 つのカテゴリ配下の主要キーワード上位 N 件を取得する（文脈連動表示用）。
     * 並び順は sort_order 昇順、同値時は alphabetical（slug 基準）。
     */
    @Transactional(readOnly = true)
    public List<TagDisplay> getTopTagsForCategory(int categoryCode, int limit, String lang) {
        List<Long> tagIds = tagCategoryRepository.findByCategoryCode(categoryCode).stream()
                .map(tc -> tc.getTagId())
                .toList();
        if (tagIds.isEmpty()) {
            return List.of();
        }
        return tagRepository.findActiveByIdIn(tagIds).stream()
                .sorted(Comparator
                        .comparingInt(Tag::getSortOrder)
                        .thenComparing(Tag::getSlug))
                .limit(limit)
                .map(t -> new TagDisplay(t.getId(), t.getSlug(), pickDisplayName(t, lang)))
                .toList();
    }

    /**
     * slug からアクティブなキーワード 1 件を取得（指定言語の表示名つき）。
     * Issue#135 3.6: 公開経路では必ず is_active=TRUE のみ。
     */
    @Transactional(readOnly = true)
    public Optional<TagDisplay> findActiveBySlugForDisplay(String slug, String lang) {
        return tagRepository.findActiveBySlug(slug)
                .map(t -> new TagDisplay(t.getId(), t.getSlug(), pickDisplayName(t, lang)));
    }

    /**
     * Issue#135: 指定写真に紐づく is_active=TRUE のタグを言語別表示名つきで返す。
     * 並び順は sort_order 昇順 + alphabetical（slug 基準）。
     */
    @Transactional(readOnly = true)
    public List<TagDisplay> findActiveTagsForPhoto(Long photoId, String lang) {
        List<Long> tagIds = photoTagRepository.findByPhotoId(photoId).stream()
                .map(pt -> pt.getTagId())
                .toList();
        if (tagIds.isEmpty()) {
            return List.of();
        }
        return tagRepository.findActiveByIdIn(tagIds).stream()
                .sorted(Comparator.comparingInt(Tag::getSortOrder).thenComparing(Tag::getSlug))
                .map(t -> new TagDisplay(t.getId(), t.getSlug(), pickDisplayName(t, lang)))
                .toList();
    }

    /**
     * Issue#135: 全アクティブタグを取得し、カテゴリ紐付け付きで返す。
     * フロントは KeywordSection の文脈連動表示・アコーディオン・検索 BOX で使う。
     */
    @Transactional(readOnly = true)
    public List<TagListItem> listAllActiveTags(String lang) {
        List<Tag> tags = tagRepository.findAll().stream()
                .filter(t -> Boolean.TRUE.equals(t.getIsActive()))
                .toList();
        if (tags.isEmpty()) {
            return List.of();
        }
        List<Long> ids = tags.stream().map(Tag::getId).toList();
        // tag_id → カテゴリコード一覧
        Map<Long, List<Integer>> categoriesByTagId = new java.util.LinkedHashMap<>();
        for (var tc : tagCategoryRepository.findByTagIdIn(ids)) {
            categoriesByTagId.computeIfAbsent(tc.getTagId(), k -> new ArrayList<>())
                    .add(tc.getCategoryCode());
        }
        return tags.stream()
                .sorted(Comparator.comparingInt(Tag::getSortOrder).thenComparing(Tag::getSlug))
                .map(t -> new TagListItem(
                        t.getId(),
                        t.getSlug(),
                        pickDisplayName(t, lang),
                        categoriesByTagId.getOrDefault(t.getId(), List.of()),
                        t.getSortOrder()))
                .toList();
    }

    /**
     * Issue#135 3.3: 翻訳欠落時のフォールバックチェーン
     * <p>{@code 指定言語 → 英語 → rekognition_label}</p>
     *
     * @param tag  対象 Tag
     * @param lang ISO 言語コード（"ja"/"en"/"zh"/"ko"/"es"）。null/不明時は英語を優先
     */
    public String pickDisplayName(Tag tag, String lang) {
        String resolved = pickByLang(tag, lang);
        if (resolved != null && !resolved.isBlank()) {
            return resolved;
        }
        // 英語フォールバック
        if (!DEFAULT_LANG.equals(lang)) {
            String en = pickByLang(tag, DEFAULT_LANG);
            if (en != null && !en.isBlank()) {
                return en;
            }
        }
        // 最終フォールバック: Rekognition ラベル名そのまま
        return tag.getRekognitionLabel();
    }

    private static String pickByLang(Tag tag, String lang) {
        if (lang == null) return null;
        return switch (lang) {
            case "ja" -> tag.getDisplayNameJa();
            case "en" -> tag.getDisplayNameEn();
            case "zh" -> tag.getDisplayNameZh();
            case "ko" -> tag.getDisplayNameKo();
            case "es" -> tag.getDisplayNameEs();
            default -> null;
        };
    }
}
