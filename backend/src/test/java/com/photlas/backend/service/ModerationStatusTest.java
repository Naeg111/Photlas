package com.photlas.backend.service;

import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.FavoriteRepository;
import com.photlas.backend.repository.PhotoCategoryRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#54: 投稿ステータス管理のテスト
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class ModerationStatusTest {

    @Autowired
    private PhotoService photoService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private PhotoCategoryRepository photoCategoryRepository;

    @Autowired
    private FavoriteRepository favoriteRepository;

    private User testUser;
    private User otherUser;
    private Category landscapeCategory;

    @BeforeEach
    void setUp() {
        photoCategoryRepository.deleteAll();
        favoriteRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();

        testUser = new User();
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash("hashedpassword");
        testUser.setRole("USER");
        testUser = userRepository.save(testUser);

        otherUser = new User();
        otherUser.setUsername("otheruser");
        otherUser.setEmail("other@example.com");
        otherUser.setPasswordHash("hashedpassword");
        otherUser.setRole("USER");
        otherUser = userRepository.save(otherUser);

        landscapeCategory = new Category();
        landscapeCategory.setName("風景");
        landscapeCategory = categoryRepository.save(landscapeCategory);
    }

    // ===== 投稿ステータスのデフォルト値テスト =====

    @Test
    @DisplayName("Issue#54 - 新規投稿のモデレーションステータスがPENDING_REVIEWになる")
    void testCreatePhoto_DefaultModerationStatus_IsPendingReview() {
        CreatePhotoRequest request = createPhotoRequest("photos/mod001.jpg", "ステータステスト");

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
        Photo savedPhoto = photoRepository.findById(response.getPhoto().getPhotoId()).orElseThrow();
        assertThat(savedPhoto.getModerationStatus()).isEqualTo(ModerationStatus.PENDING_REVIEW);
    }

    // ===== 投稿一覧のステータスフィルタリングテスト =====

    @Test
    @DisplayName("Issue#54 - 他ユーザーの投稿一覧ではPUBLISHEDの投稿のみ表示される")
    @SuppressWarnings("unchecked")
    void testGetUserPhotos_OtherUser_OnlyPublishedVisible() {
        // Given: testUserの投稿を各ステータスで作成
        Spot spot = createSpot();
        Photo published = createPhotoWithStatus(spot, "photos/pub001.jpg", "公開写真", ModerationStatus.PUBLISHED);
        Photo pending = createPhotoWithStatus(spot, "photos/pend001.jpg", "審査中写真", ModerationStatus.PENDING_REVIEW);
        Photo quarantined = createPhotoWithStatus(spot, "photos/quar001.jpg", "隔離写真", ModerationStatus.QUARANTINED);
        Photo removed = createPhotoWithStatus(spot, "photos/rem001.jpg", "削除写真", ModerationStatus.REMOVED);

        Pageable pageable = PageRequest.of(0, 20);

        // When: 他ユーザー（otherUser）がtestUserの投稿を取得
        Map<String, Object> result = photoService.getUserPhotos(
                testUser.getId(), pageable, otherUser.getEmail());

        // Then: PUBLISHEDの投稿のみ表示される
        List<PhotoResponse> content = (List<PhotoResponse>) result.get("content");
        assertThat(content).hasSize(1);
        assertThat(content.get(0).getPhoto().getPhotoId()).isEqualTo(published.getPhotoId());
    }

    @Test
    @DisplayName("Issue#54 - 投稿者本人にはPENDING_REVIEW, PUBLISHED, QUARANTINEDの投稿が表示される")
    @SuppressWarnings("unchecked")
    void testGetUserPhotos_OwnUser_PendingPublishedQuarantinedVisible() {
        // Given: testUserの投稿を各ステータスで作成
        Spot spot = createSpot();
        createPhotoWithStatus(spot, "photos/pub002.jpg", "公開写真", ModerationStatus.PUBLISHED);
        createPhotoWithStatus(spot, "photos/pend002.jpg", "審査中写真", ModerationStatus.PENDING_REVIEW);
        createPhotoWithStatus(spot, "photos/quar002.jpg", "隔離写真", ModerationStatus.QUARANTINED);
        createPhotoWithStatus(spot, "photos/rem002.jpg", "削除写真", ModerationStatus.REMOVED);

        Pageable pageable = PageRequest.of(0, 20);

        // When: 投稿者本人（testUser）が自分の投稿を取得
        Map<String, Object> result = photoService.getUserPhotos(
                testUser.getId(), pageable, testUser.getEmail());

        // Then: REMOVED以外の3件が表示される
        List<PhotoResponse> content = (List<PhotoResponse>) result.get("content");
        assertThat(content).hasSize(3);
    }

    @Test
    @DisplayName("Issue#54 - 未認証ユーザーにはPUBLISHEDの投稿のみ表示される")
    @SuppressWarnings("unchecked")
    void testGetUserPhotos_UnauthenticatedUser_OnlyPublishedVisible() {
        // Given
        Spot spot = createSpot();
        createPhotoWithStatus(spot, "photos/pub003.jpg", "公開写真", ModerationStatus.PUBLISHED);
        createPhotoWithStatus(spot, "photos/pend003.jpg", "審査中写真", ModerationStatus.PENDING_REVIEW);

        Pageable pageable = PageRequest.of(0, 20);

        // When: 未認証ユーザー（email=null）がtestUserの投稿を取得
        Map<String, Object> result = photoService.getUserPhotos(
                testUser.getId(), pageable, null);

        // Then: PUBLISHEDの投稿のみ表示される
        List<PhotoResponse> content = (List<PhotoResponse>) result.get("content");
        assertThat(content).hasSize(1);
    }

    // ===== テストヘルパーメソッド =====

    private CreatePhotoRequest createPhotoRequest(String s3Key, String title) {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle(title);
        request.setS3ObjectKey(s3Key);
        request.setTakenAt("2026-03-01T12:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));
        return request;
    }

    private Spot createSpot() {
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(testUser.getId());
        return spotRepository.save(spot);
    }

    private Photo createPhotoWithStatus(Spot spot, String s3Key, String title, ModerationStatus status) {
        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setS3ObjectKey(s3Key);
        photo.setTitle(title);
        photo.setShotAt(LocalDateTime.of(2026, 3, 1, 12, 0));
        photo.setWeather("sunny");
        photo.setModerationStatus(status);
        photo.setCategories(List.of(landscapeCategory));
        return photoRepository.save(photo);
    }
}
