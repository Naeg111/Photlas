package com.photlas.backend.repository;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.PhotoTag;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#136 Phase 2: {@code PhotoRepository.findActivePublishedByTagId} のテスト。
 *
 * <p>SSR キーワードランディングページで使う「タグ別 × ページネーション × PUBLISHED のみ
 * × 退会ユーザー除外」クエリの正しさを検証する。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PhotoRepositoryByTagTest {

    @Autowired private PhotoRepository photoRepository;
    @Autowired private PhotoTagRepository photoTagRepository;
    @Autowired private TagRepository tagRepository;
    @Autowired private UserRepository userRepository;

    private Tag tagCherry;
    private User activeUser;

    @BeforeEach
    void setUp() {
        photoTagRepository.deleteAll();
        tagRepository.deleteAll();

        tagCherry = new Tag();
        tagCherry.setRekognitionLabel("Cherry Blossom");
        tagCherry.setSlug("cherry-blossom");
        tagCherry.setDisplayNameJa("桜");
        tagCherry.setDisplayNameEn("Cherry Blossom");
        tagCherry.setIsActive(true);
        tagCherry = tagRepository.saveAndFlush(tagCherry);

        activeUser = new User();
        activeUser.setUsername("photactive");
        activeUser.setEmail("photactive@example.com");
        activeUser.setPasswordHash("dummy");
        activeUser.setRole(CodeConstants.ROLE_USER);
        activeUser = userRepository.save(activeUser);
    }

    private Photo createPhoto(User owner, int moderationStatus, LocalDateTime createdAt) {
        Photo photo = new Photo();
        photo.setSpotId(1L);
        photo.setUserId(owner.getId());
        photo.setS3ObjectKey("test/" + System.nanoTime() + "-" + Math.random() + ".jpg");
        photo.setModerationStatus(moderationStatus);
        Photo saved = photoRepository.save(photo);
        // created_at は @PrePersist で自動設定されるが、テストでは明示的に上書きする
        saved.setCreatedAt(createdAt);
        return photoRepository.saveAndFlush(saved);
    }

    private void linkPhotoToTag(Photo photo, Tag tag) {
        PhotoTag pt = new PhotoTag(photo.getPhotoId(), tag.getId());
        pt.setAssignedBy(PhotoTag.ASSIGNED_BY_AI);
        pt.setAiConfidence(85.0);
        photoTagRepository.saveAndFlush(pt);
    }

    private Pageable defaultPageable(int pageZeroIndexed, int size) {
        return PageRequest.of(pageZeroIndexed, size,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "photoId")));
    }

    // ========== 基本動作 ==========

    @Test
    @DisplayName("Issue#136 - 通常: 指定タグの PUBLISHED 写真を新着順で返す")
    void returnsPublishedPhotosOrderedByCreatedAtDesc() {
        Photo older = createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED,
                LocalDateTime.of(2026, 1, 1, 0, 0));
        Photo newer = createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED,
                LocalDateTime.of(2026, 5, 1, 0, 0));
        linkPhotoToTag(older, tagCherry);
        linkPhotoToTag(newer, tagCherry);

        Page<Photo> page = photoRepository.findActivePublishedByTagId(
                tagCherry.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED, defaultPageable(0, 10));

        assertThat(page.getContent()).hasSize(2);
        assertThat(page.getContent().get(0).getPhotoId()).isEqualTo(newer.getPhotoId());
        assertThat(page.getContent().get(1).getPhotoId()).isEqualTo(older.getPhotoId());
    }

    // ========== フィルタ条件 ==========

    @Test
    @DisplayName("Issue#136 - moderation_status = PENDING_REVIEW / QUARANTINED / REMOVED は除外")
    void excludesNonPublishedPhotos() {
        Photo published = createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED,
                LocalDateTime.now().minusDays(1));
        Photo pending = createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PENDING_REVIEW,
                LocalDateTime.now().minusDays(2));
        Photo quarantined = createPhoto(activeUser, CodeConstants.MODERATION_STATUS_QUARANTINED,
                LocalDateTime.now().minusDays(3));
        Photo removed = createPhoto(activeUser, CodeConstants.MODERATION_STATUS_REMOVED,
                LocalDateTime.now().minusDays(4));
        linkPhotoToTag(published, tagCherry);
        linkPhotoToTag(pending, tagCherry);
        linkPhotoToTag(quarantined, tagCherry);
        linkPhotoToTag(removed, tagCherry);

        Page<Photo> page = photoRepository.findActivePublishedByTagId(
                tagCherry.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED, defaultPageable(0, 10));

        assertThat(page.getContent())
                .extracting(Photo::getPhotoId)
                .containsExactly(published.getPhotoId());
    }

    @Test
    @DisplayName("Issue#136 - 退会済みユーザーの写真は除外")
    void excludesPhotosFromDeletedUsers() {
        User deletedUser = new User();
        deletedUser.setUsername("photdel");
        deletedUser.setEmail("photdel@example.com");
        deletedUser.setPasswordHash("dummy");
        deletedUser.setRole(CodeConstants.ROLE_USER);
        deletedUser.setDeletedAt(LocalDateTime.now());
        deletedUser = userRepository.save(deletedUser);

        Photo fromActive = createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED,
                LocalDateTime.now().minusDays(1));
        Photo fromDeleted = createPhoto(deletedUser, CodeConstants.MODERATION_STATUS_PUBLISHED,
                LocalDateTime.now().minusDays(2));
        linkPhotoToTag(fromActive, tagCherry);
        linkPhotoToTag(fromDeleted, tagCherry);

        Page<Photo> page = photoRepository.findActivePublishedByTagId(
                tagCherry.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED, defaultPageable(0, 10));

        assertThat(page.getContent())
                .extracting(Photo::getPhotoId)
                .containsExactly(fromActive.getPhotoId());
    }

    @Test
    @DisplayName("Issue#136 - 別のタグに紐づく写真は含まれない")
    void excludesPhotosLinkedToDifferentTag() {
        Tag tagSushi = new Tag();
        tagSushi.setRekognitionLabel("Sushi");
        tagSushi.setSlug("sushi");
        tagSushi.setDisplayNameJa("寿司");
        tagSushi.setDisplayNameEn("Sushi");
        tagSushi.setIsActive(true);
        tagSushi = tagRepository.saveAndFlush(tagSushi);

        Photo cherryPhoto = createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED,
                LocalDateTime.now().minusDays(1));
        Photo sushiPhoto = createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED,
                LocalDateTime.now().minusDays(2));
        linkPhotoToTag(cherryPhoto, tagCherry);
        linkPhotoToTag(sushiPhoto, tagSushi);

        Page<Photo> page = photoRepository.findActivePublishedByTagId(
                tagCherry.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED, defaultPageable(0, 10));

        assertThat(page.getContent())
                .extracting(Photo::getPhotoId)
                .containsExactly(cherryPhoto.getPhotoId());
    }

    // ========== ページネーション ==========

    @Test
    @DisplayName("Issue#136 - ページネーション: 49 件で 48 + 1 に分割される")
    void paginatesCorrectly() {
        for (int i = 0; i < 49; i++) {
            Photo p = createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED,
                    LocalDateTime.now().minusMinutes(i));
            linkPhotoToTag(p, tagCherry);
        }

        Page<Photo> page1 = photoRepository.findActivePublishedByTagId(
                tagCherry.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED, defaultPageable(0, 48));
        Page<Photo> page2 = photoRepository.findActivePublishedByTagId(
                tagCherry.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED, defaultPageable(1, 48));

        assertThat(page1.getContent()).hasSize(48);
        assertThat(page2.getContent()).hasSize(1);
        assertThat(page1.getTotalElements()).isEqualTo(49);
        assertThat(page1.getTotalPages()).isEqualTo(2);
    }

    @Test
    @DisplayName("Issue#136 - 決定的ソート: 同じ created_at でも photo_id DESC で順序安定")
    void deterministicSortWithSameCreatedAt() {
        LocalDateTime sameTime = LocalDateTime.of(2026, 5, 1, 12, 0);
        List<Photo> photos = List.of(
                createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED, sameTime),
                createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED, sameTime),
                createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED, sameTime)
        );
        photos.forEach(p -> linkPhotoToTag(p, tagCherry));

        Page<Photo> page = photoRepository.findActivePublishedByTagId(
                tagCherry.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED, defaultPageable(0, 10));

        // 全部同じ created_at だが photoId DESC で安定的に並ぶ
        List<Long> returnedIds = page.getContent().stream().map(Photo::getPhotoId).toList();
        List<Long> expectedIdsDesc = photos.stream()
                .map(Photo::getPhotoId)
                .sorted((a, b) -> Long.compare(b, a))
                .toList();
        assertThat(returnedIds).isEqualTo(expectedIdsDesc);
    }

    @Test
    @DisplayName("Issue#136 - 該当写真 0 件: 空ページを返す")
    void returnsEmptyPageForNoMatches() {
        Page<Photo> page = photoRepository.findActivePublishedByTagId(
                tagCherry.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED, defaultPageable(0, 10));

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isZero();
        assertThat(page.getTotalPages()).isZero();
    }
}
