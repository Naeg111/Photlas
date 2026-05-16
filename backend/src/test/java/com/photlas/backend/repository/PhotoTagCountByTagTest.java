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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#136 Phase 3: {@code PhotoTagRepository.countActivePublishedByTagId} のテスト。
 *
 * <p>TagPageController の photoCount 表示と {@code findActivePublishedByTagId} の
 * 結果件数が完全一致することを保証するための COUNT クエリ。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PhotoTagCountByTagTest {

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
        activeUser.setUsername("phtcntactive");
        activeUser.setEmail("phtcntactive@example.com");
        activeUser.setPasswordHash("dummy");
        activeUser.setRole(CodeConstants.ROLE_USER);
        activeUser = userRepository.save(activeUser);
    }

    private Photo createPhoto(User owner, int moderationStatus) {
        Photo photo = new Photo();
        photo.setSpotId(1L);
        photo.setUserId(owner.getId());
        photo.setS3ObjectKey("test/cnt-" + System.nanoTime() + "-" + Math.random() + ".jpg");
        photo.setModerationStatus(moderationStatus);
        return photoRepository.saveAndFlush(photo);
    }

    private void link(Photo photo, Tag tag) {
        PhotoTag pt = new PhotoTag(photo.getPhotoId(), tag.getId());
        pt.setAssignedBy(PhotoTag.ASSIGNED_BY_USER);
        photoTagRepository.saveAndFlush(pt);
    }

    @Test
    @DisplayName("Issue#136 - 通常: PUBLISHED 写真のみカウントされる")
    void countsPublishedOnly() {
        link(createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED), tagCherry);
        link(createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED), tagCherry);
        link(createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PENDING_REVIEW), tagCherry);
        link(createPhoto(activeUser, CodeConstants.MODERATION_STATUS_QUARANTINED), tagCherry);
        link(createPhoto(activeUser, CodeConstants.MODERATION_STATUS_REMOVED), tagCherry);

        long count = photoTagRepository.countActivePublishedByTagId(
                tagCherry.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED);

        assertThat(count).isEqualTo(2);
    }

    @Test
    @DisplayName("Issue#136 - 退会済みユーザーの写真は除外")
    void excludesDeletedUserPhotos() {
        User deletedUser = new User();
        deletedUser.setUsername("phtcntdel");
        deletedUser.setEmail("phtcntdel@example.com");
        deletedUser.setPasswordHash("dummy");
        deletedUser.setRole(CodeConstants.ROLE_USER);
        deletedUser.setDeletedAt(LocalDateTime.now());
        deletedUser = userRepository.save(deletedUser);

        link(createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED), tagCherry);
        link(createPhoto(deletedUser, CodeConstants.MODERATION_STATUS_PUBLISHED), tagCherry);

        long count = photoTagRepository.countActivePublishedByTagId(
                tagCherry.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED);

        assertThat(count).isEqualTo(1);
    }

    @Test
    @DisplayName("Issue#136 - 別タグに紐づく写真は含まれない")
    void excludesPhotosLinkedToDifferentTag() {
        Tag tagSushi = new Tag();
        tagSushi.setRekognitionLabel("Sushi");
        tagSushi.setSlug("sushi");
        tagSushi.setDisplayNameJa("寿司");
        tagSushi.setDisplayNameEn("Sushi");
        tagSushi.setIsActive(true);
        tagSushi = tagRepository.saveAndFlush(tagSushi);

        link(createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED), tagCherry);
        link(createPhoto(activeUser, CodeConstants.MODERATION_STATUS_PUBLISHED), tagSushi);

        long count = photoTagRepository.countActivePublishedByTagId(
                tagCherry.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED);

        assertThat(count).isEqualTo(1);
    }

    @Test
    @DisplayName("Issue#136 - 該当 0 件で 0L")
    void returnsZeroForNoMatches() {
        long count = photoTagRepository.countActivePublishedByTagId(
                tagCherry.getId(), CodeConstants.MODERATION_STATUS_PUBLISHED);

        assertThat(count).isZero();
    }
}
