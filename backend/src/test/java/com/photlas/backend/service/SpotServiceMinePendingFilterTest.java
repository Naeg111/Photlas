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
 * Issue#141 Phase 3 (Q-new-5/7): {@link SpotService#getMinePendingSpots} の
 * tagIds + 既存全フィルタが本人 PENDING 検索にも適用されることを検証する統合テスト。
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SpotServiceMinePendingFilterTest {

    @Autowired private SpotService spotService;
    @Autowired private SpotRepository spotRepository;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private PhotoTagRepository photoTagRepository;
    @Autowired private TagRepository tagRepository;
    @Autowired private UserRepository userRepository;

    @MockBean private S3Service s3Service;

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

        tagCherry = saveTag("Cherry", "cherry-mp1");
        tagSushi = saveTag("Sushi", "sushi-mp1");
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

    private Photo savePendingPhoto(Spot spot) {
        Photo p = new Photo();
        p.setSpotId(spot.getSpotId());
        p.setUserId(user.getId());
        p.setS3ObjectKey("uploads/" + System.nanoTime() + "-" + Math.random() + ".jpg");
        p.setModerationStatus(CodeConstants.MODERATION_STATUS_PENDING_REVIEW);
        return photoRepository.saveAndFlush(p);
    }

    private void linkTag(Photo photo, Tag tag) {
        PhotoTag pt = new PhotoTag(photo.getPhotoId(), tag.getId());
        pt.setAssignedBy(PhotoTag.ASSIGNED_BY_USER);
        photoTagRepository.saveAndFlush(pt);
    }

    @Test
    @DisplayName("Issue#141 - getMinePendingSpots: tagIds 指定でいずれかの tag が付いた PENDING 写真を持つスポットだけ返る")
    void minePending_filtersByTagIds() {
        Spot spotCherry = saveSpot("35.0", "139.0");
        Spot spotSushi = saveSpot("35.1", "139.1");
        Spot spotNone = saveSpot("35.2", "139.2");
        linkTag(savePendingPhoto(spotCherry), tagCherry);
        linkTag(savePendingPhoto(spotSushi), tagSushi);
        savePendingPhoto(spotNone);

        List<SpotResponse> result = spotService.getMinePendingSpots(NORTH, SOUTH, EAST, WEST,
                user.getId(),
                null, null, null, null, null, null, null, null, null, null,
                List.of(tagCherry.getId()));

        assertThat(result).extracting(SpotResponse::getSpotId)
                .containsExactly(spotCherry.getSpotId());
    }

    @Test
    @DisplayName("Issue#141 - getMinePendingSpots: 全フィルタ null/空のとき従来挙動 (本人 PENDING 全件)")
    void minePending_nullFilters_returnsAll() {
        Spot spotA = saveSpot("35.0", "139.0");
        Spot spotB = saveSpot("35.1", "139.1");
        savePendingPhoto(spotA);
        savePendingPhoto(spotB);

        List<SpotResponse> result = spotService.getMinePendingSpots(NORTH, SOUTH, EAST, WEST,
                user.getId(),
                null, null, null, null, null, null, null, null, null, null,
                null);

        assertThat(result).extracting(SpotResponse::getSpotId)
                .containsExactlyInAnyOrder(spotA.getSpotId(), spotB.getSpotId());
    }

    @Test
    @DisplayName("Issue#141 - getMinePendingSpots: 他人の PENDING は依然として除外される (本人 user_id 絞り込み維持)")
    void minePending_excludesOtherUsersPending() {
        String shortId = String.valueOf(System.nanoTime()).substring(0, 9);
        User other = new User();
        other.setUsername("o" + shortId);
        other.setEmail("o" + shortId + "@example.com");
        other.setPasswordHash("dummy");
        other.setRole(CodeConstants.ROLE_USER);
        other = userRepository.save(other);

        Spot spot = saveSpot("35.0", "139.0");
        Photo otherPhoto = new Photo();
        otherPhoto.setSpotId(spot.getSpotId());
        otherPhoto.setUserId(other.getId());
        otherPhoto.setS3ObjectKey("uploads/" + System.nanoTime() + ".jpg");
        otherPhoto.setModerationStatus(CodeConstants.MODERATION_STATUS_PENDING_REVIEW);
        otherPhoto = photoRepository.saveAndFlush(otherPhoto);
        linkTag(otherPhoto, tagCherry);

        List<SpotResponse> result = spotService.getMinePendingSpots(NORTH, SOUTH, EAST, WEST,
                user.getId(),
                null, null, null, null, null, null, null, null, null, null,
                List.of(tagCherry.getId()));

        assertThat(result).isEmpty();
    }
}
