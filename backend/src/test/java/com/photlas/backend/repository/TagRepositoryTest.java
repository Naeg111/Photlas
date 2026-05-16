package com.photlas.backend.repository;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.PhotoTag;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.entity.TagCategory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#135 Phase 2: Tag / TagCategory / PhotoTag リポジトリの永続化テスト。
 *
 * <p>JPA エンティティが正しくマッピングされ、Spring Data JPA 経由で
 * 保存・取得・削除ができることを検証する。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class TagRepositoryTest {

    @Autowired private TagRepository tagRepository;
    @Autowired private TagCategoryRepository tagCategoryRepository;
    @Autowired private PhotoTagRepository photoTagRepository;
    @Autowired private PhotoRepository photoRepository;

    private Tag sampleTag;

    @BeforeEach
    void setUp() {
        photoTagRepository.deleteAll();
        tagCategoryRepository.deleteAll();
        tagRepository.deleteAll();

        sampleTag = new Tag();
        sampleTag.setRekognitionLabel("Cherry Blossom");
        sampleTag.setSlug("cherry-blossom");
        sampleTag.setDisplayNameJa("桜");
        sampleTag.setDisplayNameEn("Cherry Blossom");
        sampleTag.setDisplayNameZh("樱花");
        sampleTag.setDisplayNameKo("벚꽃");
        sampleTag.setDisplayNameEs("Flor de cerezo");
        sampleTag.setSortOrder(10);
        sampleTag.setIsActive(true);
        sampleTag = tagRepository.saveAndFlush(sampleTag);
    }

    // ========== Tag ==========

    @Test
    @DisplayName("Issue#135 - Tag を保存して slug で取得できる")
    void canFindTagBySlug() {
        Optional<Tag> found = tagRepository.findBySlug("cherry-blossom");

        assertThat(found).isPresent();
        assertThat(found.get().getDisplayNameJa()).isEqualTo("桜");
        assertThat(found.get().getDisplayNameEn()).isEqualTo("Cherry Blossom");
        assertThat(found.get().getDisplayNameZh()).isEqualTo("樱花");
        assertThat(found.get().getDisplayNameKo()).isEqualTo("벚꽃");
        assertThat(found.get().getDisplayNameEs()).isEqualTo("Flor de cerezo");
        assertThat(found.get().getSortOrder()).isEqualTo(10);
        assertThat(found.get().getIsActive()).isTrue();
    }

    @Test
    @DisplayName("Issue#135 - Tag を rekognition_label で取得できる")
    void canFindTagByRekognitionLabel() {
        Optional<Tag> found = tagRepository.findByRekognitionLabel("Cherry Blossom");

        assertThat(found).isPresent();
        assertThat(found.get().getSlug()).isEqualTo("cherry-blossom");
    }

    @Test
    @DisplayName("Issue#135 - is_active=FALSE の Tag は findActiveBySlug では取得されない")
    void inactiveTagIsNotReturnedByFindActiveBySlug() {
        sampleTag.setIsActive(false);
        tagRepository.saveAndFlush(sampleTag);

        Optional<Tag> found = tagRepository.findActiveBySlug("cherry-blossom");

        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("Issue#135 - is_active=TRUE の Tag は findActiveBySlug で取得される")
    void activeTagIsReturnedByFindActiveBySlug() {
        Optional<Tag> found = tagRepository.findActiveBySlug("cherry-blossom");

        assertThat(found).isPresent();
    }

    // ========== TagCategory ==========

    @Test
    @DisplayName("Issue#135 - TagCategory を保存し、tag_id で取得できる（1 タグ → 複数カテゴリ）")
    void canLinkTagToMultipleCategories() {
        TagCategory tc1 = new TagCategory(sampleTag.getId(), CodeConstants.CATEGORY_PLANTS);
        TagCategory tc2 = new TagCategory(sampleTag.getId(), CodeConstants.CATEGORY_NATURE);
        tagCategoryRepository.saveAllAndFlush(List.of(tc1, tc2));

        List<TagCategory> found = tagCategoryRepository.findByTagId(sampleTag.getId());

        assertThat(found)
                .extracting(TagCategory::getCategoryCode)
                .containsExactlyInAnyOrder(CodeConstants.CATEGORY_PLANTS, CodeConstants.CATEGORY_NATURE);
    }

    @Test
    @DisplayName("Issue#135 - category_code で TagCategory を逆引きできる（文脈連動表示用）")
    void canFindTagCategoriesByCategoryCode() {
        tagCategoryRepository.saveAndFlush(
                new TagCategory(sampleTag.getId(), CodeConstants.CATEGORY_PLANTS));

        List<TagCategory> found = tagCategoryRepository.findByCategoryCode(CodeConstants.CATEGORY_PLANTS);

        assertThat(found)
                .extracting(TagCategory::getTagId)
                .contains(sampleTag.getId());
    }

    // ========== PhotoTag ==========

    @Test
    @DisplayName("Issue#135 - PhotoTag (AI 由来) を保存して取得できる")
    void canSaveAiOriginatedPhotoTag() {
        Photo photo = createPhoto();
        PhotoTag pt = new PhotoTag(photo.getPhotoId(), sampleTag.getId());
        pt.setAssignedBy("AI");
        pt.setAiConfidence(87.5);
        photoTagRepository.saveAndFlush(pt);

        List<PhotoTag> found = photoTagRepository.findByPhotoId(photo.getPhotoId());

        assertThat(found).hasSize(1);
        assertThat(found.get(0).getAssignedBy()).isEqualTo("AI");
        assertThat(found.get(0).getAiConfidence()).isEqualTo(87.5);
        assertThat(found.get(0).getTagId()).isEqualTo(sampleTag.getId());
    }

    @Test
    @DisplayName("Issue#135 - PhotoTag (USER 由来) は ai_confidence が NULL")
    void canSaveUserOriginatedPhotoTagWithNullConfidence() {
        Photo photo = createPhoto();
        PhotoTag pt = new PhotoTag(photo.getPhotoId(), sampleTag.getId());
        pt.setAssignedBy("USER");
        pt.setAiConfidence(null);
        photoTagRepository.saveAndFlush(pt);

        List<PhotoTag> found = photoTagRepository.findByPhotoId(photo.getPhotoId());

        assertThat(found).hasSize(1);
        assertThat(found.get(0).getAssignedBy()).isEqualTo("USER");
        assertThat(found.get(0).getAiConfidence()).isNull();
    }

    @Test
    @DisplayName("Issue#135 - 同じ (photo_id, tag_id) ペアは重複登録できない（複合主キー）")
    void duplicatePhotoTagPairIsRejected() {
        Photo photo = createPhoto();

        PhotoTag pt1 = new PhotoTag(photo.getPhotoId(), sampleTag.getId());
        pt1.setAssignedBy("AI");
        photoTagRepository.saveAndFlush(pt1);

        // 同じキーで再保存 → JpaRepository.save は merge となるため例外にはならないが、
        // 結果として 1 行のままで重複行は作られない。
        PhotoTag pt2 = new PhotoTag(photo.getPhotoId(), sampleTag.getId());
        pt2.setAssignedBy("USER");
        photoTagRepository.saveAndFlush(pt2);

        List<PhotoTag> found = photoTagRepository.findByPhotoId(photo.getPhotoId());
        assertThat(found).hasSize(1);
    }

    // ========== ヘルパー ==========

    private Photo createPhoto() {
        Photo photo = new Photo();
        photo.setSpotId(1L);
        photo.setUserId(1L);
        photo.setS3ObjectKey("test/" + System.nanoTime() + ".jpg");
        return photoRepository.save(photo);
    }
}
