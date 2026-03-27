package com.photlas.backend.service;

import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.entity.AccountSanction;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.AccountSuspendedException;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.repository.AccountSanctionRepository;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    @Autowired
    private AccountSanctionRepository accountSanctionRepository;

    private User testUser;
    private User otherUser;
    private Category landscapeCategory;

    @BeforeEach
    void setUp() {
        accountSanctionRepository.deleteAll();
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
        CreatePhotoRequest request = createPhotoRequest("photos/mod001.jpg");

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
        Photo published = createPhotoWithStatus(spot, "photos/pub001.jpg", ModerationStatus.PUBLISHED);
        Photo pending = createPhotoWithStatus(spot, "photos/pend001.jpg", ModerationStatus.PENDING_REVIEW);
        Photo quarantined = createPhotoWithStatus(spot, "photos/quar001.jpg", ModerationStatus.QUARANTINED);
        Photo removed = createPhotoWithStatus(spot, "photos/rem001.jpg", ModerationStatus.REMOVED);

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
        createPhotoWithStatus(spot, "photos/pub002.jpg", ModerationStatus.PUBLISHED);
        createPhotoWithStatus(spot, "photos/pend002.jpg", ModerationStatus.PENDING_REVIEW);
        createPhotoWithStatus(spot, "photos/quar002.jpg", ModerationStatus.QUARANTINED);
        createPhotoWithStatus(spot, "photos/rem002.jpg", ModerationStatus.REMOVED);

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
        createPhotoWithStatus(spot, "photos/pub003.jpg", ModerationStatus.PUBLISHED);
        createPhotoWithStatus(spot, "photos/pend003.jpg", ModerationStatus.PENDING_REVIEW);

        Pageable pageable = PageRequest.of(0, 20);

        // When: 未認証ユーザー（email=null）がtestUserの投稿を取得
        Map<String, Object> result = photoService.getUserPhotos(
                testUser.getId(), pageable, null);

        // Then: PUBLISHEDの投稿のみ表示される
        List<PhotoResponse> content = (List<PhotoResponse>) result.get("content");
        assertThat(content).hasSize(1);
    }

    // ===== 写真詳細のステータスフィルタリングテスト =====

    @Test
    @DisplayName("Issue#54 - REMOVED状態の写真は詳細取得できない")
    void testGetPhotoDetail_RemovedPhoto_ThrowsException() {
        Spot spot = createSpot();
        Photo removed = createPhotoWithStatus(spot, "photos/rem010.jpg", ModerationStatus.REMOVED);

        org.junit.jupiter.api.Assertions.assertThrows(
                com.photlas.backend.exception.PhotoNotFoundException.class,
                () -> photoService.getPhotoDetail(removed.getPhotoId(), testUser.getEmail())
        );
    }

    @Test
    @DisplayName("Issue#54 - PENDING_REVIEW状態の写真は投稿者本人のみ詳細取得できる")
    void testGetPhotoDetail_PendingPhoto_OnlyOwnerCanView() {
        Spot spot = createSpot();
        Photo pending = createPhotoWithStatus(spot, "photos/pend010.jpg", ModerationStatus.PENDING_REVIEW);

        // 投稿者本人は取得可能
        PhotoResponse response = photoService.getPhotoDetail(pending.getPhotoId(), testUser.getEmail());
        assertThat(response).isNotNull();

        // 他ユーザーは取得不可
        org.junit.jupiter.api.Assertions.assertThrows(
                com.photlas.backend.exception.PhotoNotFoundException.class,
                () -> photoService.getPhotoDetail(pending.getPhotoId(), otherUser.getEmail())
        );
    }

    @Test
    @DisplayName("Issue#54 - QUARANTINED状態の写真は投稿者本人のみ詳細取得できる")
    void testGetPhotoDetail_QuarantinedPhoto_OnlyOwnerCanView() {
        Spot spot = createSpot();
        Photo quarantined = createPhotoWithStatus(spot, "photos/quar010.jpg", ModerationStatus.QUARANTINED);

        // 投稿者本人は取得可能
        PhotoResponse response = photoService.getPhotoDetail(quarantined.getPhotoId(), testUser.getEmail());
        assertThat(response).isNotNull();

        // 未認証ユーザーは取得不可
        org.junit.jupiter.api.Assertions.assertThrows(
                com.photlas.backend.exception.PhotoNotFoundException.class,
                () -> photoService.getPhotoDetail(quarantined.getPhotoId(), null)
        );
    }

    @Test
    @DisplayName("Issue#54 - PUBLISHED状態の写真は誰でも詳細取得できる")
    void testGetPhotoDetail_PublishedPhoto_AnyoneCanView() {
        Spot spot = createSpot();
        Photo published = createPhotoWithStatus(spot, "photos/pub010.jpg", ModerationStatus.PUBLISHED);

        // 他ユーザーが取得可能
        PhotoResponse response = photoService.getPhotoDetail(published.getPhotoId(), otherUser.getEmail());
        assertThat(response).isNotNull();

        // 未認証ユーザーも取得可能
        PhotoResponse response2 = photoService.getPhotoDetail(published.getPhotoId(), null);
        assertThat(response2).isNotNull();
    }

    // ===== レスポンスにモデレーションステータスが含まれるテスト =====

    @Test
    @DisplayName("Issue#54 - 写真詳細レスポンスにmoderation_statusが含まれる")
    void testGetPhotoDetail_ResponseContainsModerationStatus() {
        Spot spot = createSpot();
        Photo quarantined = createPhotoWithStatus(spot, "photos/quar020.jpg", ModerationStatus.QUARANTINED);

        PhotoResponse response = photoService.getPhotoDetail(quarantined.getPhotoId(), testUser.getEmail());

        assertThat(response.getPhoto().getModerationStatus()).isEqualTo("QUARANTINED");
    }

    @Test
    @DisplayName("Issue#54 - PENDING_REVIEW写真のレスポンスにmoderation_statusが含まれる")
    void testGetPhotoDetail_PendingReviewResponseContainsModerationStatus() {
        Spot spot = createSpot();
        Photo pending = createPhotoWithStatus(spot, "photos/pend020.jpg", ModerationStatus.PENDING_REVIEW);

        PhotoResponse response = photoService.getPhotoDetail(pending.getPhotoId(), testUser.getEmail());

        assertThat(response.getPhoto().getModerationStatus()).isEqualTo("PENDING_REVIEW");
    }

    @Test
    @DisplayName("Issue#54 - PUBLISHED写真のレスポンスにmoderation_statusがPUBLISHEDで含まれる")
    void testGetPhotoDetail_PublishedResponseContainsModerationStatus() {
        Spot spot = createSpot();
        Photo published = createPhotoWithStatus(spot, "photos/pub020.jpg", ModerationStatus.PUBLISHED);

        PhotoResponse response = photoService.getPhotoDetail(published.getPhotoId(), testUser.getEmail());

        assertThat(response.getPhoto().getModerationStatus()).isEqualTo("PUBLISHED");
    }

    // ===== REMOVED写真の投稿者本人アクセステスト =====

    @Test
    @DisplayName("Issue#54 - REMOVED状態の写真は投稿者本人でも詳細取得できない")
    void testGetPhotoDetail_RemovedPhoto_OwnerCannotView() {
        Spot spot = createSpot();
        Photo removed = createPhotoWithStatus(spot, "photos/rem011.jpg", ModerationStatus.REMOVED);

        assertThatThrownBy(() ->
                photoService.getPhotoDetail(removed.getPhotoId(), testUser.getEmail())
        ).isInstanceOf(PhotoNotFoundException.class);
    }

    // ===== getPhotoForOwnerテスト =====

    @Test
    @DisplayName("Issue#54 - getPhotoForOwnerで投稿者本人は写真を取得できる")
    void testGetPhotoForOwner_Owner_ReturnsPhoto() {
        Spot spot = createSpot();
        Photo photo = createPhotoWithStatus(spot, "photos/owner001.jpg", ModerationStatus.PENDING_REVIEW);

        Photo result = photoService.getPhotoForOwner(photo.getPhotoId(), testUser.getId());

        assertThat(result).isNotNull();
        assertThat(result.getPhotoId()).isEqualTo(photo.getPhotoId());
    }

    @Test
    @DisplayName("Issue#54 - getPhotoForOwnerで他ユーザーは写真を取得できない")
    void testGetPhotoForOwner_OtherUser_ThrowsException() {
        Spot spot = createSpot();
        Photo photo = createPhotoWithStatus(spot, "photos/owner002.jpg", ModerationStatus.PENDING_REVIEW);

        assertThatThrownBy(() ->
                photoService.getPhotoForOwner(photo.getPhotoId(), otherUser.getId())
        ).isInstanceOf(PhotoNotFoundException.class);
    }

    @Test
    @DisplayName("Issue#54 - getPhotoForOwnerで存在しない写真IDは例外")
    void testGetPhotoForOwner_NonExistentPhoto_ThrowsException() {
        assertThatThrownBy(() ->
                photoService.getPhotoForOwner(99999L, testUser.getId())
        ).isInstanceOf(PhotoNotFoundException.class);
    }

    // ===== アカウント停止チェックテスト =====

    @Test
    @DisplayName("Issue#54 - 永久停止ユーザーは写真を投稿できない")
    void testCreatePhoto_PermanentlySuspendedUser_ThrowsException() {
        testUser.setRole("SUSPENDED");
        userRepository.save(testUser);

        CreatePhotoRequest request = createPhotoRequest("photos/suspended001.jpg");

        assertThatThrownBy(() ->
                photoService.createPhoto(request, testUser.getEmail())
        ).isInstanceOf(AccountSuspendedException.class);
    }

    @Test
    @DisplayName("Issue#54 - 一時停止中のユーザーは写真を投稿できない")
    void testCreatePhoto_TemporarilySuspendedUser_ThrowsException() {
        AccountSanction sanction = new AccountSanction();
        sanction.setUserId(testUser.getId());
        sanction.setSanctionType("TEMPORARY_SUSPENSION");
        sanction.setSuspendedUntil(LocalDateTime.now().plusDays(30));
        sanction.setReason("違反行為");
        accountSanctionRepository.save(sanction);

        CreatePhotoRequest request = createPhotoRequest("photos/tempsuspended001.jpg");

        assertThatThrownBy(() ->
                photoService.createPhoto(request, testUser.getEmail())
        ).isInstanceOf(AccountSuspendedException.class);
    }

    @Test
    @DisplayName("Issue#54 - 一時停止期間が終了したユーザーは写真を投稿できる")
    void testCreatePhoto_ExpiredTemporarySuspension_CanPost() {
        AccountSanction sanction = new AccountSanction();
        sanction.setUserId(testUser.getId());
        sanction.setSanctionType("TEMPORARY_SUSPENSION");
        sanction.setSuspendedUntil(LocalDateTime.now().minusDays(1));
        sanction.setReason("違反行為");
        accountSanctionRepository.save(sanction);

        CreatePhotoRequest request = createPhotoRequest("photos/expired001.jpg");

        PhotoResponse response = photoService.createPhoto(request, testUser.getEmail());

        assertThat(response).isNotNull();
    }

    // ===== テストヘルパーメソッド =====

    private CreatePhotoRequest createPhotoRequest(String s3Key) {
        CreatePhotoRequest request = new CreatePhotoRequest();
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

    private Photo createPhotoWithStatus(Spot spot, String s3Key, ModerationStatus status) {
        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setS3ObjectKey(s3Key);
        photo.setShotAt(LocalDateTime.of(2026, 3, 1, 12, 0));
        photo.setWeather("sunny");
        photo.setModerationStatus(status);
        photo.setCategories(List.of(landscapeCategory));
        return photoRepository.save(photo);
    }
}
