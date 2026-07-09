package com.photlas.backend.service;

import com.photlas.backend.dto.TagDisplay;
import com.photlas.backend.dto.TagListItem;
import com.photlas.backend.dto.TagSuggestion;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.PhotoTag;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.entity.TagCategory;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

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

    /** Issue#142: 動物(207)配下の中立な鳥タグ「鳥」の slug（焦点距離リマップで注入）。 */
    private static final String COMPANION_BIRD_SLUG = "companion-bird";

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
     * Issue#136 Phase 8: SSR ランディング 0 件時の関連キーワード取得 (Q5)。
     *
     * <p>挙動:</p>
     * <ol>
     *   <li>{@code tagId} のカテゴリ集合を取得</li>
     *   <li>それらカテゴリに紐づく他 tag (多対多重複は distinct で排除、自分自身も除外)</li>
     *   <li>{@code is_active=TRUE} のみ、{@code sort_order 昇順 + slug 二次ソート}、{@code limit} 適用</li>
     * </ol>
     *
     * <p>カテゴリ未紐付け、または関連 0 件の場合は空リストを返す。</p>
     */
    @Transactional(readOnly = true)
    public List<TagDisplay> findRelatedActiveTags(Long tagId, int limit, String lang) {
        List<Integer> categoryCodes = tagCategoryRepository.findByTagId(tagId).stream()
                .map(tc -> tc.getCategoryCode())
                .distinct()
                .toList();
        if (categoryCodes.isEmpty()) {
            return List.of();
        }
        List<Long> peerTagIds = tagCategoryRepository.findByCategoryCodeIn(categoryCodes).stream()
                .map(tc -> tc.getTagId())
                .filter(id -> !id.equals(tagId))
                .distinct()
                .toList();
        if (peerTagIds.isEmpty()) {
            return List.of();
        }
        return tagRepository.findActiveByIdIn(peerTagIds).stream()
                .sorted(Comparator.comparingInt(Tag::getSortOrder).thenComparing(Tag::getSlug))
                .limit(limit)
                .map(t -> new TagDisplay(t.getId(), t.getSlug(), pickDisplayName(t, lang)))
                .toList();
    }

    /**
     * Rekognition ラベル群から AI 提案キーワードを抽出する（Issue#142: 焦点距離リマップ付き）。
     *
     * <p>Issue#135 3.4.1 のベース抽出に加え、Issue#142 で焦点距離による後処理リマップを行う:</p>
     * <ul>
     *   <li>{@code focalLength35mm ≥ 300mm}: 従来どおり（野鳥全般＋種別タグをそのまま提案）</li>
     *   <li>{@code <300mm} または欠落: 候補のうち 208(野鳥)のみに属する野鳥系タグを除去し、
     *       中立な「鳥」({@code companion-bird}, 207) を 1 件注入する
     *       （confidence は除去した野鳥系タグの最大値を引き継ぐ）</li>
     * </ul>
     * <p>閾値 300mm は {@link ExifBasedCategoryHints#R3_5_MIN_FOCAL_35MM} と共有する。</p>
     *
     * @param labels          Rekognition ラベル
     * @param focalLength35mm 35mm 換算焦点距離（解析リクエストで渡される。欠落時 {@link Optional#empty()}）
     */
    @Transactional(readOnly = true)
    public List<TagSuggestion> extractSuggestions(List<Label> labels, Optional<Integer> focalLength35mm) {
        List<TagSuggestion> base = extractBaseSuggestions(labels);
        // ≥300mm は従来どおり（野鳥全般＋種別を維持）
        if (focalLength35mm.filter(f -> f >= ExifBasedCategoryHints.R3_5_MIN_FOCAL_35MM).isPresent()) {
            return base;
        }
        // <300mm または欠落: 野鳥専用タグを companion-bird(207) にリマップ
        return remapWildBirdToCompanion(base);
    }

    /**
     * Issue#135 3.4.1: 直接マッチのみ・信頼度 {@value #CONFIDENCE_THRESHOLD}% 以上・
     * {@code is_active=TRUE} のタグのみ・最大 {@value #MAX_SUGGESTIONS} 件（信頼度上位）。
     */
    private List<TagSuggestion> extractBaseSuggestions(List<Label> labels) {
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
     * Issue#142: 候補のうち「208(野鳥)に属し 207(動物)に属さない」野鳥専用タグを除去し、
     * 中立な「鳥」({@code companion-bird}, 207) を 1 件注入する。野鳥専用候補が無ければ何もしない。
     * companion-bird が未投入（通常は V43 で存在）なら安全側で base をそのまま返す。
     */
    private List<TagSuggestion> remapWildBirdToCompanion(List<TagSuggestion> base) {
        if (base.isEmpty()) {
            return base;
        }
        List<Long> ids = new ArrayList<>();
        for (TagSuggestion s : base) {
            ids.add(s.tagId());
        }
        // tag_id → 所属カテゴリ集合（1 クエリで一括取得）
        Map<Long, Set<Integer>> catsByTag = new HashMap<>();
        for (TagCategory tc : tagCategoryRepository.findByTagIdIn(ids)) {
            catsByTag.computeIfAbsent(tc.getTagId(), k -> new HashSet<>()).add(tc.getCategoryCode());
        }
        // 208(野鳥)に属し 207(動物)に属さない＝野鳥専用タグ
        Set<Long> wildBirdOnlyIds = new HashSet<>();
        for (TagSuggestion s : base) {
            Set<Integer> cats = catsByTag.getOrDefault(s.tagId(), Set.of());
            if (cats.contains(CodeConstants.CATEGORY_WILD_BIRDS)
                    && !cats.contains(CodeConstants.CATEGORY_ANIMALS)) {
                wildBirdOnlyIds.add(s.tagId());
            }
        }
        if (wildBirdOnlyIds.isEmpty()) {
            return base; // 野鳥専用候補が無ければリマップ不要
        }
        Optional<Tag> companion = tagRepository.findActiveBySlug(COMPANION_BIRD_SLUG);
        if (companion.isEmpty()) {
            return base; // companion-bird 未投入（通常は V43 で存在）。安全側で従来どおり
        }
        // 除去する野鳥専用タグの最大 confidence を companion-bird に引き継ぐ
        float maxConf = 0f;
        List<TagSuggestion> kept = new ArrayList<>();
        for (TagSuggestion s : base) {
            if (wildBirdOnlyIds.contains(s.tagId())) {
                maxConf = Math.max(maxConf, s.confidence());
            } else {
                kept.add(s);
            }
        }
        Tag c = companion.get();
        kept.add(new TagSuggestion(c.getId(), c.getSlug(), pickDisplayName(c, null), maxConf));
        kept.sort(Comparator.comparing(TagSuggestion::confidence).reversed());
        return kept;
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
     * 写真の詳細カテゴリー（キーワード）を丸ごと置き換える（編集用）。
     *
     * <p>既存の {@code photo_tags} を全削除してから、指定タグを USER 割当として登録し直す。
     * {@code tagIds} が空なら全消去になる。編集では AI 由来／ユーザー選択の区別は行わず、
     * すべて {@link PhotoTag#ASSIGNED_BY_USER} として保存する（AI 再解析はしないため）。</p>
     *
     * @param photoId 対象写真の ID
     * @param tagIds  新しいキーワード ID リスト（null/空なら全消去）
     */
    @Transactional
    public void replacePhotoTags(Long photoId, List<Long> tagIds) {
        photoTagRepository.deleteByPhotoId(photoId);
        assignTagsToPhoto(photoId, tagIds, PhotoTag.ASSIGNED_BY_USER, Map.of());
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
     * Issue#135 + Issue#141 後追い: 全アクティブタグを取得し、カテゴリ紐付け + photoCount 付きで返す。
     * フロントは KeywordSection の文脈連動表示・アコーディオン・検索 BOX で使う。
     * photoCount=0 のタグはフィルタ画面で非活性表示される。
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
        // Issue#141 後追い: tag_id → photoCount (PUBLISHED + 退会済除外)。
        // 1 本のクエリで一括取得して N+1 を回避。0 件 tag は countMap に登場しないため getOrDefault(0L)
        Map<Long, Long> countByTagId = new java.util.HashMap<>();
        for (var row : photoTagRepository.countActivePublishedGroupedByTagId(
                CodeConstants.MODERATION_STATUS_PUBLISHED)) {
            countByTagId.put((Long) row[0], (Long) row[1]);
        }
        return tags.stream()
                .sorted(Comparator.comparingInt(Tag::getSortOrder).thenComparing(Tag::getSlug))
                .map(t -> new TagListItem(
                        t.getId(),
                        t.getSlug(),
                        pickDisplayName(t, lang),
                        categoriesByTagId.getOrDefault(t.getId(), List.of()),
                        t.getSortOrder(),
                        countByTagId.getOrDefault(t.getId(), 0L)))
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
