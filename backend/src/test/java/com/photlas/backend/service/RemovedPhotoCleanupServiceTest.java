package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.springframework.boot.test.mock.mockito.MockBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;

/**
 * Issue#54: REMOVED投稿の180日後物理削除サービスのテスト
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class RemovedPhotoCleanupServiceTest {

    @Autowired
    private RemovedPhotoCleanupService cleanupService;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private com.photlas.backend.repository.CategoryRepository categoryRepository;

    @Autowired
    private EntityManager entityManager;

    @MockBean
    private S3Service s3Service;

    private User testUser;
    private Spot testSpot;

    @BeforeEach
    void setUp() {
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();

        testUser = new User();
        testUser.setUsername("cleanup");
        testUser.setEmail("cleanup@example.com");
        testUser.setPasswordHash("hashedpassword");
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser = userRepository.save(testUser);

        testSpot = new Spot();
        testSpot.setLatitude(new BigDecimal("35.658581"));
        testSpot.setLongitude(new BigDecimal("139.745433"));
        testSpot.setCreatedByUserId(testUser.getId());
        testSpot = spotRepository.save(testSpot);
    }

    @Test
    @DisplayName("Issue#54 - 180日以上前にREMOVEDされた写真が物理削除される")
    void testCleanup_RemovesOldRemovedPhotos() {
        Photo oldRemoved = createPhoto("old-removed.jpg", CodeConstants.MODERATION_STATUS_REMOVED);
        // updated_atを181日前に設定
        updateUpdatedAt(oldRemoved.getPhotoId(), LocalDateTime.now().minusDays(181));

        cleanupService.cleanupRemovedPhotos();

        assertThat(photoRepository.findById(oldRemoved.getPhotoId())).isEmpty();
    }

    @Test
    @DisplayName("Issue#54 - 180日未満のREMOVED写真は削除されない")
    void testCleanup_KeepsRecentRemovedPhotos() {
        Photo recentRemoved = createPhoto("recent-removed.jpg", CodeConstants.MODERATION_STATUS_REMOVED);
        // updated_atを179日前に設定
        updateUpdatedAt(recentRemoved.getPhotoId(), LocalDateTime.now().minusDays(179));

        cleanupService.cleanupRemovedPhotos();

        assertThat(photoRepository.findById(recentRemoved.getPhotoId())).isPresent();
    }

    @Test
    @DisplayName("Issue#54 - PUBLISHED写真は削除されない")
    void testCleanup_KeepsPublishedPhotos() {
        Photo published = createPhoto("published.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);
        // 古い写真でもPUBLISHEDなら削除されない
        updateUpdatedAt(published.getPhotoId(), LocalDateTime.now().minusDays(365));

        cleanupService.cleanupRemovedPhotos();

        assertThat(photoRepository.findById(published.getPhotoId())).isPresent();
    }

    @Test
    @DisplayName("Issue#54 - 複数のREMOVED写真のうち古いものだけ削除される")
    void testCleanup_OnlyDeletesOldOnes() {
        Photo old1 = createPhoto("old1.jpg", CodeConstants.MODERATION_STATUS_REMOVED);
        Photo old2 = createPhoto("old2.jpg", CodeConstants.MODERATION_STATUS_REMOVED);
        Photo recent = createPhoto("recent.jpg", CodeConstants.MODERATION_STATUS_REMOVED);

        updateUpdatedAt(old1.getPhotoId(), LocalDateTime.now().minusDays(200));
        updateUpdatedAt(old2.getPhotoId(), LocalDateTime.now().minusDays(190));
        updateUpdatedAt(recent.getPhotoId(), LocalDateTime.now().minusDays(10));

        cleanupService.cleanupRemovedPhotos();

        assertThat(photoRepository.findById(old1.getPhotoId())).isEmpty();
        assertThat(photoRepository.findById(old2.getPhotoId())).isEmpty();
        assertThat(photoRepository.findById(recent.getPhotoId())).isPresent();
    }

    // ===== Issue#62: S3削除テスト =====

    @Test
    @DisplayName("Issue#62 - 物理削除時にS3の元画像とサムネイルが削除される")
    void testCleanup_deletesS3Objects() {
        Photo photo = createPhoto("uploads/1/abc.jpg", CodeConstants.MODERATION_STATUS_REMOVED);
        updateUpdatedAt(photo.getPhotoId(), LocalDateTime.now().minusDays(200));

        cleanupService.cleanupRemovedPhotos();

        verify(s3Service).deleteS3Object("uploads/1/abc.jpg");
        verify(s3Service).deleteS3Object("thumbnails/uploads/1/abc.webp");
        assertThat(photoRepository.findById(photo.getPhotoId())).isEmpty();
    }

    @Test
    @DisplayName("Issue#62 - 削除対象がない場合はS3削除が呼ばれない")
    void testCleanup_noPhotos_noS3Delete() {
        cleanupService.cleanupRemovedPhotos();

        verify(s3Service, never()).deleteS3Object(anyString());
    }

    // ===== レポート#41 #1: 関連レコード削除テスト =====

    @Test
    @DisplayName("レポート#41 #1 - photo_categoriesの関連レコードがある写真を物理削除できる")
    void testCleanup_deletesPhotosWithCategories() {
        // カテゴリ付きの写真を作成
        com.photlas.backend.entity.Category category = new com.photlas.backend.entity.Category();
        category.setCategoryId(CodeConstants.CATEGORY_NATURE);
        category.setName("自然風景");
        categoryRepository.save(category);

        Photo photo = createPhoto("uploads/1/cat-test.jpg", CodeConstants.MODERATION_STATUS_REMOVED);
        photo.setCategories(java.util.List.of(category));
        photoRepository.save(photo);
        entityManager.flush();

        updateUpdatedAt(photo.getPhotoId(), LocalDateTime.now().minusDays(200));

        // 物理削除を実行 - photo_categoriesの関連レコードがあってもエラーにならないこと
        cleanupService.cleanupRemovedPhotos();

        assertThat(photoRepository.findById(photo.getPhotoId())).isEmpty();
    }

    // ===== ヘルパーメソッド =====

    private Photo createPhoto(String s3Key, Integer status) {
        Photo photo = new Photo();
        photo.setSpotId(testSpot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setS3ObjectKey(s3Key);
        photo.setShotAt(LocalDateTime.of(2026, 1, 1, 12, 0));
        photo.setModerationStatus(status);
        return photoRepository.save(photo);
    }

    private void updateUpdatedAt(Long photoId, LocalDateTime updatedAt) {
        entityManager.createNativeQuery(
                "UPDATE photos SET updated_at = :updatedAt WHERE photo_id = :photoId")
                .setParameter("updatedAt", updatedAt)
                .setParameter("photoId", photoId)
                .executeUpdate();
        entityManager.flush();
        entityManager.clear();
    }
}
