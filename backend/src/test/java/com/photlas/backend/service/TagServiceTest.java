package com.photlas.backend.service;

import com.photlas.backend.dto.TagDisplay;
import com.photlas.backend.dto.TagSuggestion;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.PhotoTag;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.entity.TagCategory;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.PhotoTagRepository;
import com.photlas.backend.repository.TagCategoryRepository;
import com.photlas.backend.repository.TagRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.rekognition.model.Label;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#135 Phase 5: {@link TagService} の統合テスト。
 *
 * <p>Spring と H2 を起動し、{@link TagRepository} 等と連携した
 * 振る舞いを検証する。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class TagServiceTest {

    @Autowired private TagService tagService;
    @Autowired private TagRepository tagRepository;
    @Autowired private TagCategoryRepository tagCategoryRepository;
    @Autowired private PhotoTagRepository photoTagRepository;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private UserRepository userRepository;

    @BeforeEach
    void setUp() {
        photoTagRepository.deleteAll();
        tagCategoryRepository.deleteAll();
        tagRepository.deleteAll();
    }

    private Tag saveTag(String rekognitionLabel, String slug, String ja, String en) {
        Tag tag = new Tag();
        tag.setRekognitionLabel(rekognitionLabel);
        tag.setSlug(slug);
        tag.setDisplayNameJa(ja);
        tag.setDisplayNameEn(en);
        tag.setIsActive(true);
        tag.setSortOrder(100);
        return tagRepository.saveAndFlush(tag);
    }

    private void linkCategory(Long tagId, int categoryCode) {
        tagCategoryRepository.saveAndFlush(new TagCategory(tagId, categoryCode));
    }

    // ========== extractSuggestions ==========

    @Test
    @DisplayName("Issue#135 - extractSuggestions: Rekognition ラベルが辞書にあれば TagSuggestion を返す")
    void extractSuggestionsDirectMatch() {
        Tag cherry = saveTag("Cherry Blossom", "cherry-blossom", "桜", "Cherry Blossom");
        linkCategory(cherry.getId(), CodeConstants.CATEGORY_PLANTS);

        List<TagSuggestion> result = tagService.extractSuggestions(List.of(
                Label.builder().name("Cherry Blossom").confidence(92.0f).build()
        ));

        assertThat(result).hasSize(1);
        assertThat(result.get(0).tagId()).isEqualTo(cherry.getId());
        assertThat(result.get(0).slug()).isEqualTo("cherry-blossom");
        assertThat(result.get(0).confidence()).isEqualTo(92.0f);
    }

    @Test
    @DisplayName("Issue#135 - extractSuggestions: 信頼度 80% 未満は除外")
    void extractSuggestionsFiltersLowConfidence() {
        saveTag("Mountain", "mountain", "山", "Mountain");

        List<TagSuggestion> result = tagService.extractSuggestions(List.of(
                Label.builder().name("Mountain").confidence(79.9f).build()
        ));

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Issue#135 - extractSuggestions: 親フォールバックは Phase 1 では使わない（直接マッチのみ）")
    void extractSuggestionsDoesNotFallBackToParents() {
        // Husky は辞書に無いが Dog はある
        saveTag("Dog", "dog", "犬", "Dog");
        // Husky を親 Dog 付きで投入
        software.amazon.awssdk.services.rekognition.model.Parent dogParent =
                software.amazon.awssdk.services.rekognition.model.Parent.builder().name("Dog").build();
        Label husky = Label.builder().name("Husky").confidence(95f).parents(dogParent).build();

        List<TagSuggestion> result = tagService.extractSuggestions(List.of(husky));

        // 親に Dog があっても Husky 自体は辞書にないので候補に出ない
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Issue#135 - extractSuggestions: is_active=FALSE のタグは候補から除外")
    void extractSuggestionsExcludesInactiveTags() {
        Tag t = saveTag("Mountain", "mountain", "山", "Mountain");
        t.setIsActive(false);
        tagRepository.saveAndFlush(t);

        List<TagSuggestion> result = tagService.extractSuggestions(List.of(
                Label.builder().name("Mountain").confidence(95f).build()
        ));

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Issue#135 - extractSuggestions: 提案は最大 10 個。信頼度上位を採用")
    void extractSuggestionsLimitsToTopTen() {
        // 12 個のタグを辞書に追加
        for (int i = 0; i < 12; i++) {
            saveTag("Label" + i, "label-" + i, "ラベル" + i, "Label" + i);
        }
        // Rekognition から 12 個のラベルを信頼度 80..91 で返す
        List<Label> labels = new java.util.ArrayList<>();
        for (int i = 0; i < 12; i++) {
            labels.add(Label.builder().name("Label" + i).confidence(80f + i).build());
        }

        List<TagSuggestion> result = tagService.extractSuggestions(labels);

        assertThat(result).hasSize(10);
        // 上位 10 件 = 信頼度 82〜91 (= Label2〜Label11)
        assertThat(result).allSatisfy(s -> assertThat(s.confidence()).isGreaterThanOrEqualTo(82f));
    }

    // ========== assignTagsToPhoto ==========

    @Test
    @DisplayName("Issue#135 - assignTagsToPhoto: 指定タグを photo_tags に保存（assigned_by + ai_confidence 反映）")
    void assignTagsToPhotoPersistsAssignedByAndConfidence() {
        Photo photo = createPhoto();
        Tag t1 = saveTag("Cherry Blossom", "cherry-blossom", "桜", "Cherry Blossom");
        Tag t2 = saveTag("Lighting", "lighting", "ライティング", "Lighting");

        tagService.assignTagsToPhoto(
                photo.getPhotoId(),
                List.of(t1.getId(), t2.getId()),
                PhotoTag.ASSIGNED_BY_AI,
                Map.of(t1.getId(), 92.5, t2.getId(), 88.0)
        );

        List<PhotoTag> saved = photoTagRepository.findByPhotoId(photo.getPhotoId());
        assertThat(saved).hasSize(2);
        assertThat(saved).allSatisfy(pt -> assertThat(pt.getAssignedBy()).isEqualTo("AI"));
        assertThat(saved)
                .extracting(PhotoTag::getAiConfidence)
                .containsExactlyInAnyOrder(92.5, 88.0);
    }

    @Test
    @DisplayName("Issue#135 - assignTagsToPhoto: USER 由来は ai_confidence が NULL でも保存される")
    void assignTagsToPhotoUserOriginatedHasNullConfidence() {
        Photo photo = createPhoto();
        Tag t = saveTag("Mountain", "mountain", "山", "Mountain");

        tagService.assignTagsToPhoto(
                photo.getPhotoId(),
                List.of(t.getId()),
                PhotoTag.ASSIGNED_BY_USER,
                Map.of()
        );

        List<PhotoTag> saved = photoTagRepository.findByPhotoId(photo.getPhotoId());
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getAssignedBy()).isEqualTo("USER");
        assertThat(saved.get(0).getAiConfidence()).isNull();
    }

    // ========== getTopTagsForCategory ==========

    @Test
    @DisplayName("Issue#135 - getTopTagsForCategory: 文脈連動表示用に sort_order 昇順で上限 N 件")
    void getTopTagsForCategoryRespectsSortOrderAndLimit() {
        Tag a = saveTag("AAA", "aaa", "A", "AAA"); a.setSortOrder(20); tagRepository.saveAndFlush(a);
        Tag b = saveTag("BBB", "bbb", "B", "BBB"); b.setSortOrder(10); tagRepository.saveAndFlush(b);
        Tag c = saveTag("CCC", "ccc", "C", "CCC"); c.setSortOrder(30); tagRepository.saveAndFlush(c);
        linkCategory(a.getId(), CodeConstants.CATEGORY_PLANTS);
        linkCategory(b.getId(), CodeConstants.CATEGORY_PLANTS);
        linkCategory(c.getId(), CodeConstants.CATEGORY_PLANTS);

        List<TagDisplay> result = tagService.getTopTagsForCategory(
                CodeConstants.CATEGORY_PLANTS, 2, "ja");

        assertThat(result).hasSize(2);
        // sort_order 10 (BBB), 20 (AAA) の順
        assertThat(result.get(0).slug()).isEqualTo("bbb");
        assertThat(result.get(1).slug()).isEqualTo("aaa");
    }

    @Test
    @DisplayName("Issue#135 - getTopTagsForCategory: is_active=FALSE は除外")
    void getTopTagsForCategoryExcludesInactive() {
        Tag a = saveTag("AAA", "aaa", "A", "AAA");
        Tag b = saveTag("BBB", "bbb", "B", "BBB");
        b.setIsActive(false); tagRepository.saveAndFlush(b);
        linkCategory(a.getId(), CodeConstants.CATEGORY_PLANTS);
        linkCategory(b.getId(), CodeConstants.CATEGORY_PLANTS);

        List<TagDisplay> result = tagService.getTopTagsForCategory(
                CodeConstants.CATEGORY_PLANTS, 10, "ja");

        assertThat(result).extracting(TagDisplay::slug).containsExactly("aaa");
    }

    // ========== findActiveBySlugForDisplay / pickDisplayName ==========

    @Test
    @DisplayName("Issue#135 - findActiveBySlugForDisplay: 指定言語の表示名で返す")
    void findActiveBySlugForDisplayReturnsLocalizedName() {
        Tag t = saveTag("Cherry Blossom", "cherry-blossom", "桜", "Cherry Blossom");
        t.setDisplayNameZh("樱花");
        t.setDisplayNameKo("벚꽃");
        t.setDisplayNameEs("Flor de cerezo");
        tagRepository.saveAndFlush(t);

        Optional<TagDisplay> ja = tagService.findActiveBySlugForDisplay("cherry-blossom", "ja");
        Optional<TagDisplay> zh = tagService.findActiveBySlugForDisplay("cherry-blossom", "zh");
        Optional<TagDisplay> es = tagService.findActiveBySlugForDisplay("cherry-blossom", "es");

        assertThat(ja.orElseThrow().displayName()).isEqualTo("桜");
        assertThat(zh.orElseThrow().displayName()).isEqualTo("樱花");
        assertThat(es.orElseThrow().displayName()).isEqualTo("Flor de cerezo");
    }

    @Test
    @DisplayName("Issue#135 - findActiveBySlugForDisplay: 翻訳欠落時は英語 → rekognition_label にフォールバック")
    void findActiveBySlugForDisplayFallsBackToEnglishThenLabel() {
        // 中国語のみ NULL
        Tag t = saveTag("Cherry Blossom", "cherry-blossom", "桜", "Cherry Blossom");
        tagRepository.saveAndFlush(t);

        // zh は NULL なので英語にフォールバック
        Optional<TagDisplay> zh = tagService.findActiveBySlugForDisplay("cherry-blossom", "zh");
        assertThat(zh.orElseThrow().displayName()).isEqualTo("Cherry Blossom");
    }

    @Test
    @DisplayName("Issue#135 - findActiveBySlugForDisplay: 存在しない / is_active=FALSE は空")
    void findActiveBySlugForDisplayReturnsEmptyForMissingOrInactive() {
        assertThat(tagService.findActiveBySlugForDisplay("nope", "ja")).isEmpty();

        Tag t = saveTag("Mountain", "mountain", "山", "Mountain");
        t.setIsActive(false);
        tagRepository.saveAndFlush(t);
        assertThat(tagService.findActiveBySlugForDisplay("mountain", "ja")).isEmpty();
    }

    // ========== Issue#136 Phase 4: findPhotosForTag ==========

    @Test
    @DisplayName("Issue#136 - findPhotosForTag: 該当タグの PUBLISHED 写真を Page で返す")
    void findPhotosForTagReturnsPublishedPhotos() {
        Tag tag = saveTag("Cherry Blossom", "cherry-blossom", "桜", "Cherry Blossom");

        Photo p1 = createPublishedPhoto();
        Photo p2 = createPublishedPhoto();
        PhotoTag pt1 = new PhotoTag(p1.getPhotoId(), tag.getId());
        pt1.setAssignedBy(PhotoTag.ASSIGNED_BY_AI);
        photoTagRepository.saveAndFlush(pt1);
        PhotoTag pt2 = new PhotoTag(p2.getPhotoId(), tag.getId());
        pt2.setAssignedBy(PhotoTag.ASSIGNED_BY_USER);
        photoTagRepository.saveAndFlush(pt2);

        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(
                0, 48,
                org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "createdAt")
                        .and(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "photoId")));
        org.springframework.data.domain.Page<Photo> page = tagService.findPhotosForTag(tag.getId(), pageable);

        assertThat(page.getContent()).hasSize(2);
        assertThat(page.getTotalElements()).isEqualTo(2);
    }

    @Test
    @DisplayName("Issue#136 - findPhotosForTag: 該当タグが無ければ空ページ")
    void findPhotosForTagReturnsEmptyForUnknownTag() {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 48);
        org.springframework.data.domain.Page<Photo> page = tagService.findPhotosForTag(99999L, pageable);

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isZero();
    }

    // ========== ヘルパー ==========

    private Photo createPhoto() {
        Photo photo = new Photo();
        photo.setSpotId(1L);
        photo.setUserId(1L);
        photo.setS3ObjectKey("test/" + System.nanoTime() + ".jpg");
        return photoRepository.save(photo);
    }

    private Photo createPublishedPhoto() {
        // findActivePublishedByTagId は users.deleted_at IS NULL の JOIN を含むため、
        // 実在のアクティブユーザーが必要
        // username は 2-12 文字制約。System.nanoTime() の下 8 桁で短く生成
        String shortId = String.valueOf(System.nanoTime()).substring(0, 9);
        User user = new User();
        user.setUsername("u" + shortId);
        user.setEmail("u" + shortId + "@example.com");
        user.setPasswordHash("dummy");
        user.setRole(CodeConstants.ROLE_USER);
        user = userRepository.save(user);

        Photo photo = new Photo();
        photo.setSpotId(1L);
        photo.setUserId(user.getId());
        photo.setS3ObjectKey("tagsrv/" + System.nanoTime() + "-" + Math.random() + ".jpg");
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        return photoRepository.saveAndFlush(photo);
    }
}
