package com.photlas.backend.service;

import com.photlas.backend.dto.SpotResponse;
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
 * Issue#141 Phase 1: {@link SpotService#getSpots} の tagIds 引数で
 * 「いずれかの tag が付いた写真を持つスポット」だけ返ることを検証する統合テスト。
 *
 * <p>tagIds 空/null のときは従来挙動を維持する (センチネル `-1L` 方式)。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SpotServiceTagFilterTest {

    @Autowired private SpotService spotService;
    @Autowired private SpotRepository spotRepository;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private PhotoTagRepository photoTagRepository;
    @Autowired private TagRepository tagRepository;
    @Autowired private UserRepository userRepository;

    @MockBean private S3Service s3Service;

    // 地図 bounds (テスト用に広範囲)
    private static final BigDecimal NORTH = new BigDecimal("90");
    private static final BigDecimal SOUTH = new BigDecimal("-90");
    private static final BigDecimal EAST = new BigDecimal("180");
    private static final BigDecimal WEST = new BigDecimal("-180");

    private User user;
    private Tag tagCherry;
    private Tag tagSushi;

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

        tagCherry = saveTag("Cherry Blossom", "cherry-blossom-tf1");
        tagSushi = saveTag("Sushi", "sushi-tf1");
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

    private Spot saveSpot(String lat, String lng) {
        Spot s = new Spot();
        s.setLatitude(new BigDecimal(lat));
        s.setLongitude(new BigDecimal(lng));
        s.setCreatedByUserId(user.getId());
        return spotRepository.saveAndFlush(s);
    }

    private Photo savePhoto(Spot spot) {
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
    @DisplayName("Issue#141 - getSpots: tagIds 指定でいずれかの tag が付いた写真を持つスポットだけ返る")
    void getSpots_filtersByTagIds() {
        Spot spotCherry = saveSpot("35.0", "139.0");
        Spot spotSushi = saveSpot("35.1", "139.1");
        Spot spotNone = saveSpot("35.2", "139.2");
        linkTag(savePhoto(spotCherry), tagCherry);
        linkTag(savePhoto(spotSushi), tagSushi);
        savePhoto(spotNone); // タグ無し

        List<SpotResponse> result = spotService.getSpots(NORTH, SOUTH, EAST, WEST,
                null, null, null, null, null, null, null, null, null, null,
                List.of(tagCherry.getId()));

        assertThat(result).extracting(SpotResponse::getSpotId)
                .containsExactly(spotCherry.getSpotId());
    }

    @Test
    @DisplayName("Issue#141 - getSpots: tagIds 複数指定で OR 検索 (いずれかが付けば返る)")
    void getSpots_orSearchAcrossMultipleTags() {
        Spot spotCherry = saveSpot("35.0", "139.0");
        Spot spotSushi = saveSpot("35.1", "139.1");
        Spot spotNone = saveSpot("35.2", "139.2");
        linkTag(savePhoto(spotCherry), tagCherry);
        linkTag(savePhoto(spotSushi), tagSushi);
        savePhoto(spotNone);

        List<SpotResponse> result = spotService.getSpots(NORTH, SOUTH, EAST, WEST,
                null, null, null, null, null, null, null, null, null, null,
                List.of(tagCherry.getId(), tagSushi.getId()));

        assertThat(result).extracting(SpotResponse::getSpotId)
                .containsExactlyInAnyOrder(spotCherry.getSpotId(), spotSushi.getSpotId());
    }

    @Test
    @DisplayName("Issue#141 - getSpots: tagIds=null のとき従来挙動 (全スポット返却)")
    void getSpots_nullTagIds_returnsAllSpots() {
        Spot spotCherry = saveSpot("35.0", "139.0");
        Spot spotNone = saveSpot("35.2", "139.2");
        linkTag(savePhoto(spotCherry), tagCherry);
        savePhoto(spotNone);

        List<SpotResponse> result = spotService.getSpots(NORTH, SOUTH, EAST, WEST,
                null, null, null, null, null, null, null, null, null, null,
                null);

        assertThat(result).extracting(SpotResponse::getSpotId)
                .containsExactlyInAnyOrder(spotCherry.getSpotId(), spotNone.getSpotId());
    }

    @Test
    @DisplayName("Issue#141 - getSpots: tagIds=空リストでも従来挙動")
    void getSpots_emptyTagIds_returnsAllSpots() {
        Spot spotCherry = saveSpot("35.0", "139.0");
        Spot spotNone = saveSpot("35.2", "139.2");
        linkTag(savePhoto(spotCherry), tagCherry);
        savePhoto(spotNone);

        List<SpotResponse> result = spotService.getSpots(NORTH, SOUTH, EAST, WEST,
                null, null, null, null, null, null, null, null, null, null,
                List.of());

        assertThat(result).extracting(SpotResponse::getSpotId)
                .containsExactlyInAnyOrder(spotCherry.getSpotId(), spotNone.getSpotId());
    }

    @Test
    @DisplayName("Issue#141 - getSpots: 存在しない tagId は静かに空結果")
    void getSpots_unknownTagId_returnsEmpty() {
        Spot spot = saveSpot("35.0", "139.0");
        linkTag(savePhoto(spot), tagCherry);

        List<SpotResponse> result = spotService.getSpots(NORTH, SOUTH, EAST, WEST,
                null, null, null, null, null, null, null, null, null, null,
                List.of(999_999L));

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Issue#141 - getSpots: 退会済みユーザーの写真は tagIds 検索でも除外される")
    void getSpots_excludesDeletedUserPhotos() {
        String shortId = String.valueOf(System.nanoTime()).substring(0, 9);
        User deleted = new User();
        deleted.setUsername("d" + shortId);
        deleted.setEmail("d" + shortId + "@example.com");
        deleted.setPasswordHash("dummy");
        deleted.setRole(CodeConstants.ROLE_USER);
        deleted.setDeletedAt(java.time.LocalDateTime.now());
        deleted = userRepository.save(deleted);

        Spot spot = saveSpot("35.0", "139.0");
        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(deleted.getId());
        photo.setS3ObjectKey("uploads/" + System.nanoTime() + ".jpg");
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        photo = photoRepository.saveAndFlush(photo);
        linkTag(photo, tagCherry);

        List<SpotResponse> result = spotService.getSpots(NORTH, SOUTH, EAST, WEST,
                null, null, null, null, null, null, null, null, null, null,
                List.of(tagCherry.getId()));

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("Issue#141 - getSpots: PUBLISHED 以外のステータスは tagIds 検索でも除外される")
    void getSpots_excludesNonPublishedPhotos() {
        Spot spot = saveSpot("35.0", "139.0");
        Photo pending = new Photo();
        pending.setSpotId(spot.getSpotId());
        pending.setUserId(user.getId());
        pending.setS3ObjectKey("uploads/" + System.nanoTime() + ".jpg");
        pending.setModerationStatus(CodeConstants.MODERATION_STATUS_PENDING_REVIEW);
        pending = photoRepository.saveAndFlush(pending);
        linkTag(pending, tagCherry);

        List<SpotResponse> result = spotService.getSpots(NORTH, SOUTH, EAST, WEST,
                null, null, null, null, null, null, null, null, null, null,
                List.of(tagCherry.getId()));

        assertThat(result).isEmpty();
    }
}
