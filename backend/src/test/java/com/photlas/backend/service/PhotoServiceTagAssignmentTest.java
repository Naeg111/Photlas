package com.photlas.backend.service;

import com.photlas.backend.dto.CachedAnalyzeResult;
import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.dto.TagSuggestion;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.PhotoTag;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoTagRepository;
import com.photlas.backend.repository.TagCategoryRepository;
import com.photlas.backend.repository.TagRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#135 Phase 7: PhotoService#createPhoto がリクエストの tagIds から
 * photo_tags を保存する振る舞いを検証する。
 *
 * <p>S3Service だけモック化し、他は本物の repository を使う統合テスト。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PhotoServiceTagAssignmentTest {

    @Autowired private PhotoService photoService;
    @Autowired private UserRepository userRepository;
    @Autowired private TagRepository tagRepository;
    @Autowired private TagCategoryRepository tagCategoryRepository;
    @Autowired private PhotoTagRepository photoTagRepository;
    @Autowired private AiPredictionCacheService aiPredictionCacheService;

    @MockBean private S3Service s3Service;

    private User user;
    private Tag tagCherry;
    private Tag tagSushi;
    private Tag tagMaple;

    @BeforeEach
    void setUp() {
        // S3 はファイル存在を常に true で返す（実 S3 不要）
        Mockito.when(s3Service.existsInS3(ArgumentMatchers.anyString())).thenReturn(true);
        Mockito.when(s3Service.deriveThumbnailKey(ArgumentMatchers.anyString()))
                .thenReturn("uploads/thumb.jpg");

        // クリーンアップ
        photoTagRepository.deleteAll();
        tagCategoryRepository.deleteAll();
        tagRepository.deleteAll();

        // テストユーザー
        user = new User();
        user.setUsername("phototagtest");
        user.setEmail("phototagtest@example.com");
        user.setPasswordHash("dummy");
        user.setRole(CodeConstants.ROLE_USER);
        user = userRepository.save(user);

        // テストタグ
        tagCherry = saveTag("Cherry Blossom", "cherry-blossom");
        tagSushi = saveTag("Sushi", "sushi");
        tagMaple = saveTag("Maple", "maple");
    }

    @Test
    @DisplayName("Issue#135 - createPhoto: tagIds で指定されたタグが photo_tags に保存される")
    void createPhoto_savesTagAssignments() {
        CreatePhotoRequest req = baseRequest();
        req.setTagIds(List.of(tagCherry.getId(), tagSushi.getId()));

        Long photoId = photoService.createPhoto(req, user.getEmail()).getPhoto().getPhotoId();

        List<PhotoTag> saved = photoTagRepository.findByPhotoId(photoId);
        assertThat(saved)
                .extracting(PhotoTag::getTagId)
                .containsExactlyInAnyOrder(tagCherry.getId(), tagSushi.getId());
    }

    @Test
    @DisplayName("Issue#135 - createPhoto: aiOriginatedTagIds に含まれるタグは assigned_by='AI'、それ以外は 'USER'")
    void createPhoto_distinguishesAiVsUserOrigin() {
        CreatePhotoRequest req = baseRequest();
        // 全部選択
        req.setTagIds(List.of(tagCherry.getId(), tagSushi.getId(), tagMaple.getId()));
        // AI 由来は cherry と sushi。maple はユーザー手動
        req.setAiOriginatedTagIds(List.of(tagCherry.getId(), tagSushi.getId()));

        Long photoId = photoService.createPhoto(req, user.getEmail()).getPhoto().getPhotoId();

        List<PhotoTag> saved = photoTagRepository.findByPhotoId(photoId);
        assertThat(saved).hasSize(3);
        for (PhotoTag pt : saved) {
            if (pt.getTagId().equals(tagCherry.getId()) || pt.getTagId().equals(tagSushi.getId())) {
                assertThat(pt.getAssignedBy()).isEqualTo(PhotoTag.ASSIGNED_BY_AI);
            } else {
                assertThat(pt.getAssignedBy()).isEqualTo(PhotoTag.ASSIGNED_BY_USER);
            }
        }
    }

    @Test
    @DisplayName("Issue#135 - createPhoto: tagIds が null/空 なら photo_tags は作成されない（任意項目）")
    void createPhoto_emptyTagIds_doesNotCreatePhotoTagsRow() {
        CreatePhotoRequest req = baseRequest();
        // tagIds は未設定（null）

        Long photoId = photoService.createPhoto(req, user.getEmail()).getPhoto().getPhotoId();

        assertThat(photoTagRepository.findByPhotoId(photoId)).isEmpty();
    }

    @Test
    @DisplayName("Issue#135 - createPhoto: aiOriginatedTagIds 指定なしの場合は全タグが USER 扱い")
    void createPhoto_withoutAiOriginated_treatsAllAsUser() {
        CreatePhotoRequest req = baseRequest();
        req.setTagIds(List.of(tagMaple.getId()));
        // aiOriginatedTagIds 未指定

        Long photoId = photoService.createPhoto(req, user.getEmail()).getPhoto().getPhotoId();

        List<PhotoTag> saved = photoTagRepository.findByPhotoId(photoId);
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getAssignedBy()).isEqualTo(PhotoTag.ASSIGNED_BY_USER);
    }

    // ========== ヘルパー ==========

    private Tag saveTag(String label, String slug) {
        Tag t = new Tag();
        t.setRekognitionLabel(label);
        t.setSlug(slug);
        t.setDisplayNameJa(label);
        t.setDisplayNameEn(label);
        t.setIsActive(true);
        return tagRepository.saveAndFlush(t);
    }

    private CreatePhotoRequest baseRequest() {
        CreatePhotoRequest req = new CreatePhotoRequest();
        req.setS3ObjectKey("uploads/" + user.getId() + "/" + java.util.UUID.randomUUID() + ".jpg");
        req.setTakenAt("2026-01-01T12:00:00");
        req.setLatitude(new BigDecimal("35.658581"));
        req.setLongitude(new BigDecimal("139.745433"));
        return req;
    }

    // ========== Issue#136 §3.5: AI 由来 tag_id の ai_confidence が NULL でなく実数値 ==========

    @Test
    @DisplayName("Issue#136 - createPhoto: AI 由来 tag は cache の suggestedTags から ai_confidence が入る")
    void createPhoto_aiOriginatedTag_setsAiConfidenceFromCache() {
        // cache に Cherry を suggestedTags として保存（confidence=92.5）
        String token = aiPredictionCacheService.save(new CachedAnalyzeResult(
                new LabelMappingResult(List.of(CodeConstants.CATEGORY_PLANTS), null, java.util.Map.of()),
                List.of(new TagSuggestion(tagCherry.getId(), tagCherry.getSlug(), "桜", 92.5f))
        ));

        CreatePhotoRequest req = baseRequest();
        // 既存テストに倣ってカテゴリは設定しない（カテゴリ seed が不要）
        req.setAnalyzeToken(token);
        req.setTagIds(List.of(tagCherry.getId()));
        req.setAiOriginatedTagIds(List.of(tagCherry.getId()));

        var response = photoService.createPhoto(req, user.getEmail());

        List<PhotoTag> tags = photoTagRepository.findByPhotoId(response.getPhoto().getPhotoId());
        assertThat(tags).hasSize(1);
        assertThat(tags.get(0).getAssignedBy()).isEqualTo(PhotoTag.ASSIGNED_BY_AI);
        // §3.5 要件: ai_confidence が NULL でなく実数値
        assertThat(tags.get(0).getAiConfidence()).isEqualTo(92.5);
    }
}
