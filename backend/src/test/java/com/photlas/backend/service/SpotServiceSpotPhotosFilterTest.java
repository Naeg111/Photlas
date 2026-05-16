package com.photlas.backend.service;

import com.photlas.backend.dto.SpotPhotosResponse;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.PhotoTag;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.PhotoTagRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.TagRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#141 Phase 4 (Q-new-6/7): {@link SpotService#getSpotPhotos} の
 * tagIds + 既存全フィルタが /spots/photos にも適用されることを検証する。
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SpotServiceSpotPhotosFilterTest {

    @Autowired private SpotService spotService;
    @Autowired private SpotRepository spotRepository;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private PhotoTagRepository photoTagRepository;
    @Autowired private TagRepository tagRepository;
    @Autowired private UserRepository userRepository;

    @MockBean private S3Service s3Service;

    private User user;
    private Tag tagCherry;
    private Tag tagSushi;
    private Spot spot;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.when(s3Service.existsInS3(org.mockito.ArgumentMatchers.anyString())).thenReturn(true);

        photoTagRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        tagRepository.deleteAll();

        String shortId = String.valueOf(System.nanoTime()).substring(0, 9);
        user = new User();
        user.setUsername("u" + shortId);
        user.setEmail("u" + shortId + "@example.com");
        user.setPasswordHash("dummy");
        user.setRole(CodeConstants.ROLE_USER);
        user = userRepository.save(user);

        tagCherry = saveTag("Cherry", "cherry-sp1");
        tagSushi = saveTag("Sushi", "sushi-sp1");

        spot = new Spot();
        spot.setLatitude(new BigDecimal("35.0"));
        spot.setLongitude(new BigDecimal("139.0"));
        spot.setCreatedByUserId(user.getId());
        spot = spotRepository.saveAndFlush(spot);
    }

    private Tag saveTag(String label, String slug) {
        Tag t = new Tag();
        t.setRekognitionLabel(label);
        t.setSlug(slug);
        t.setDisplayNameJa(label);
        t.setDisplayNameEn(label);
        t.setIsActive(true);
        return tagRepository.saveAndFlush(t);
    }

    private Photo savePhoto() {
        Photo p = new Photo();
        p.setSpotId(spot.getSpotId());
        p.setUserId(user.getId());
        p.setS3ObjectKey("uploads/" + System.nanoTime() + "-" + Math.random() + ".jpg");
        p.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        return photoRepository.saveAndFlush(p);
    }

    private void linkTag(Photo photo, Tag tag) {
        PhotoTag pt = new PhotoTag(photo.getPhotoId(), tag.getId());
        pt.setAssignedBy(PhotoTag.ASSIGNED_BY_USER);
        photoTagRepository.saveAndFlush(pt);
    }

    @Test
    @DisplayName("Issue#141 - getSpotPhotos: tagIds 指定で該当 tag の写真だけ返る (no viewer)")
    void spotPhotos_filtersByTagIds_noViewer() {
        Photo cherryPhoto = savePhoto();
        Photo sushiPhoto = savePhoto();
        Photo nonePhoto = savePhoto();
        linkTag(cherryPhoto, tagCherry);
        linkTag(sushiPhoto, tagSushi);

        SpotPhotosResponse result = spotService.getSpotPhotos(
                List.of(spot.getSpotId()), 10, 0,
                null, null, null, null, null,
                null, null, null, null, null,
                List.of(tagCherry.getId()),
                null);

        assertThat(result.getIds()).containsExactly(cherryPhoto.getPhotoId());
        assertThat(result.getTotal()).isEqualTo(1);
    }

    @Test
    @DisplayName("Issue#141 - getSpotPhotos: tagIds=null は従来挙動 (全件返却 no viewer)")
    void spotPhotos_nullTagIds_returnsAll_noViewer() {
        Photo a = savePhoto();
        Photo b = savePhoto();

        SpotPhotosResponse result = spotService.getSpotPhotos(
                List.of(spot.getSpotId()), 10, 0,
                null, null, null, null, null,
                null, null, null, null, null,
                null,
                null);

        assertThat(result.getIds()).containsExactlyInAnyOrder(a.getPhotoId(), b.getPhotoId());
    }

    @Test
    @DisplayName("Issue#141 - getSpotPhotos: tagIds 指定で該当 tag の写真だけ返る (with viewer = 本人 PENDING 含む)")
    void spotPhotos_filtersByTagIds_withViewer() {
        Photo published = savePhoto();
        Photo pending = new Photo();
        pending.setSpotId(spot.getSpotId());
        pending.setUserId(user.getId());
        pending.setS3ObjectKey("uploads/" + System.nanoTime() + ".jpg");
        pending.setModerationStatus(CodeConstants.MODERATION_STATUS_PENDING_REVIEW);
        pending = photoRepository.saveAndFlush(pending);
        linkTag(published, tagCherry);
        linkTag(pending, tagCherry);
        savePhoto(); // tag 無し

        SpotPhotosResponse result = spotService.getSpotPhotos(
                List.of(spot.getSpotId()), 10, 0,
                null, null, null, null, null,
                null, null, null, null, null,
                List.of(tagCherry.getId()),
                user.getId());

        assertThat(result.getIds())
                .containsExactlyInAnyOrder(published.getPhotoId(), pending.getPhotoId());
    }

    @Test
    @DisplayName("Issue#141 - getSpotPhotos: subject_categories フィルタも適用される")
    void spotPhotos_filtersBySubjectCategories() {
        // 簡易テスト: subject_categories=999 (存在しない) を渡したら 0 件
        Photo p = savePhoto();
        linkTag(p, tagCherry);

        SpotPhotosResponse result = spotService.getSpotPhotos(
                List.of(spot.getSpotId()), 10, 0,
                List.of(999), null, null, null, null,
                null, null, null, null, null,
                null,
                null);

        assertThat(result.getIds()).isEmpty();
    }
}
