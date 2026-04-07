package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.AccountSanction;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.repository.AccountSanctionRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.ReportRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.repository.ViolationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Issue#54: 管理者モデレーション操作のテスト
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class AdminModerationServiceTest {

    @Autowired
    private AdminModerationService adminModerationService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private ViolationRepository violationRepository;

    @Autowired
    private AccountSanctionRepository accountSanctionRepository;

    private User photoOwner;
    private Spot testSpot;

    @BeforeEach
    void setUp() {
        accountSanctionRepository.deleteAll();
        violationRepository.deleteAll();
        reportRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();

        photoOwner = createUser("owner", "owner@example.com");
        testSpot = createSpot();
    }

    @Test
    @DisplayName("Issue#54 - 隔離中の写真を「問題なし」にするとPUBLISHEDになる")
    void testApprovePhoto_QuarantinedPhoto_BecomesPublished() {
        Photo photo = createPhotoWithStatus("photos/approve001.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);

        adminModerationService.approvePhoto(photo.getPhotoId());

        Photo updated = photoRepository.findById(photo.getPhotoId()).orElseThrow();
        assertThat(updated.getModerationStatus()).isEqualTo(CodeConstants.MODERATION_STATUS_PUBLISHED);
    }

    @Test
    @DisplayName("Issue#54 - 隔離中の写真を「違反あり」にするとREMOVEDになる")
    void testRejectPhoto_QuarantinedPhoto_BecomesRemoved() {
        Photo photo = createPhotoWithStatus("photos/reject001.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);

        adminModerationService.rejectPhoto(photo.getPhotoId(), "利用規約違反");

        Photo updated = photoRepository.findById(photo.getPhotoId()).orElseThrow();
        assertThat(updated.getModerationStatus()).isEqualTo(CodeConstants.MODERATION_STATUS_REMOVED);
    }

    @Test
    @DisplayName("Issue#54 - PENDING_REVIEW状態の写真を承認するとPUBLISHEDになる")
    void testApprovePhoto_PendingReviewPhoto_BecomesPublished() {
        Photo photo = createPhotoWithStatus("photos/approve002.jpg", CodeConstants.MODERATION_STATUS_PENDING_REVIEW);

        adminModerationService.approvePhoto(photo.getPhotoId());

        Photo updated = photoRepository.findById(photo.getPhotoId()).orElseThrow();
        assertThat(updated.getModerationStatus()).isEqualTo(CodeConstants.MODERATION_STATUS_PUBLISHED);
    }

    @Test
    @DisplayName("Issue#54 - 存在しない写真を拒否しようとすると例外")
    void testRejectPhoto_NonExistentPhoto_ThrowsException() {
        assertThatThrownBy(() -> adminModerationService.rejectPhoto(99999L, "違反理由"))
                .isInstanceOf(PhotoNotFoundException.class);
    }

    @Test
    @DisplayName("Issue#54 - 存在しない写真を承認しようとすると例外")
    void testApprovePhoto_NonExistentPhoto_ThrowsException() {
        assertThatThrownBy(() -> adminModerationService.approvePhoto(99999L))
                .isInstanceOf(PhotoNotFoundException.class);
    }

    @Test
    @DisplayName("Issue#54 - 違反あり操作で違反履歴が作成される")
    void testRejectPhoto_CreatesViolationRecord() {
        Photo photo = createPhotoWithStatus("photos/violation001.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);

        adminModerationService.rejectPhoto(photo.getPhotoId(), "不適切なコンテンツ");

        // 違反履歴が1件作成されること
        long violationCount = adminModerationService.getViolationCount(photoOwner.getId());
        assertThat(violationCount).isEqualTo(1);
    }

    // ===== アカウント制裁テスト =====

    @Test
    @DisplayName("Issue#54 - 違反1回目: WARNING制裁が作成される")
    void testRejectPhoto_FirstViolation_CreatesWarning() {
        Photo photo = createPhotoWithStatus("photos/v1.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);

        adminModerationService.rejectPhoto(photo.getPhotoId(), "不適切なコンテンツ");

        List<AccountSanction> sanctions = accountSanctionRepository.findByUserIdOrderByCreatedAtDesc(photoOwner.getId());
        assertThat(sanctions).hasSize(1);
        assertThat(sanctions.get(0).getSanctionType()).isEqualTo(CodeConstants.SANCTION_WARNING);
        assertThat(sanctions.get(0).getSuspendedUntil()).isNull();
    }

    @Test
    @DisplayName("Issue#54 - 違反2回目: TEMPORARY_SUSPENSION制裁（60日間投稿停止）")
    void testRejectPhoto_SecondViolation_CreatesTemporarySuspension() {
        // 1回目の違反
        Photo photo1 = createPhotoWithStatus("photos/v2a.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);
        adminModerationService.rejectPhoto(photo1.getPhotoId(), "不適切なコンテンツ");

        // 2回目の違反
        Photo photo2 = createPhotoWithStatus("photos/v2b.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);
        adminModerationService.rejectPhoto(photo2.getPhotoId(), "暴力的コンテンツ");

        List<AccountSanction> sanctions = accountSanctionRepository.findByUserIdOrderByCreatedAtDesc(photoOwner.getId());
        assertThat(sanctions).hasSize(2);

        // 最新の制裁がTEMPORARY_SUSPENSION
        AccountSanction latest = sanctions.get(0);
        assertThat(latest.getSanctionType()).isEqualTo(CodeConstants.SANCTION_TEMPORARY_SUSPENSION);
        assertThat(latest.getSuspendedUntil()).isNotNull();
        // suspendedUntilが約60日後であること
        assertThat(latest.getSuspendedUntil()).isAfter(LocalDateTime.now().plusDays(59));
        assertThat(latest.getSuspendedUntil()).isBefore(LocalDateTime.now().plusDays(61));
    }

    @Test
    @DisplayName("Issue#54 - 違反3回目: PERMANENT_SUSPENSION制裁（永久停止）")
    void testRejectPhoto_ThirdViolation_CreatesPermanentSuspension() {
        // 1回目
        Photo photo1 = createPhotoWithStatus("photos/v3a.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);
        adminModerationService.rejectPhoto(photo1.getPhotoId(), "不適切なコンテンツ");

        // 2回目
        Photo photo2 = createPhotoWithStatus("photos/v3b.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);
        adminModerationService.rejectPhoto(photo2.getPhotoId(), "暴力的コンテンツ");

        // 3回目
        Photo photo3 = createPhotoWithStatus("photos/v3c.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);
        adminModerationService.rejectPhoto(photo3.getPhotoId(), "著作権侵害");

        List<AccountSanction> sanctions = accountSanctionRepository.findByUserIdOrderByCreatedAtDesc(photoOwner.getId());
        assertThat(sanctions).hasSize(3);

        // 最新の制裁がPERMANENT_SUSPENSION
        AccountSanction latest = sanctions.get(0);
        assertThat(latest.getSanctionType()).isEqualTo(CodeConstants.SANCTION_PERMANENT_SUSPENSION);
        assertThat(latest.getSuspendedUntil()).isNull();
    }

    @Test
    @DisplayName("Issue#54 - 永久停止時: ユーザーのロールがSUSPENDEDになる")
    void testRejectPhoto_PermanentSuspension_UserRoleChangedToSuspended() {
        Photo photo1 = createPhotoWithStatus("photos/vs1.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);
        adminModerationService.rejectPhoto(photo1.getPhotoId(), "違反1");

        Photo photo2 = createPhotoWithStatus("photos/vs2.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);
        adminModerationService.rejectPhoto(photo2.getPhotoId(), "違反2");

        Photo photo3 = createPhotoWithStatus("photos/vs3.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);
        adminModerationService.rejectPhoto(photo3.getPhotoId(), "違反3");

        User updated = userRepository.findById(photoOwner.getId()).orElseThrow();
        assertThat(updated.getRole()).isEqualTo(CodeConstants.ROLE_SUSPENDED);
    }

    @Test
    @DisplayName("Issue#54 - 永久停止時: ユーザーの公開写真がREMOVEDになる")
    void testRejectPhoto_PermanentSuspension_AllPhotosRemoved() {
        // 公開中の写真を追加
        Photo publishedPhoto = createPhotoWithStatus("photos/pub.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);

        // 3回の違反
        Photo photo1 = createPhotoWithStatus("photos/ban1.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);
        adminModerationService.rejectPhoto(photo1.getPhotoId(), "違反1");

        Photo photo2 = createPhotoWithStatus("photos/ban2.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);
        adminModerationService.rejectPhoto(photo2.getPhotoId(), "違反2");

        Photo photo3 = createPhotoWithStatus("photos/ban3.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);
        adminModerationService.rejectPhoto(photo3.getPhotoId(), "違反3");

        // 公開中だった写真もREMOVEDになる
        Photo updatedPublished = photoRepository.findById(publishedPhoto.getPhotoId()).orElseThrow();
        assertThat(updatedPublished.getModerationStatus()).isEqualTo(CodeConstants.MODERATION_STATUS_REMOVED);
    }

    // ===== Issue#54: S3隔離フロー整合性テスト =====

    @Test
    @DisplayName("Issue#54 - 承認時にs3_object_keyからquarantined/プレフィックスが除去される")
    void testApprovePhoto_RestoresS3ObjectKey() {
        Photo photo = createPhotoWithStatus("quarantined/uploads/1/test.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);

        adminModerationService.approvePhoto(photo.getPhotoId());

        Photo updated = photoRepository.findById(photo.getPhotoId()).orElseThrow();
        assertThat(updated.getS3ObjectKey()).isEqualTo("uploads/1/test.jpg");
    }

    @Test
    @DisplayName("Issue#54 - 拒否時にs3_object_keyはquarantined/のまま維持される")
    void testRejectPhoto_KeepsQuarantinedS3ObjectKey() {
        Photo photo = createPhotoWithStatus("quarantined/uploads/1/test.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);

        adminModerationService.rejectPhoto(photo.getPhotoId(), "利用規約違反");

        Photo updated = photoRepository.findById(photo.getPhotoId()).orElseThrow();
        assertThat(updated.getS3ObjectKey()).startsWith("quarantined/");
    }

    // ===== テストヘルパーメソッド =====

    private User createUser(String username, String email) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash("hashedpassword");
        user.setRole(CodeConstants.ROLE_USER);
        return userRepository.save(user);
    }

    private Spot createSpot() {
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(photoOwner.getId());
        return spotRepository.save(spot);
    }

    private Photo createPhotoWithStatus(String s3Key, Integer status) {
        Photo photo = new Photo();
        photo.setSpotId(testSpot.getSpotId());
        photo.setUserId(photoOwner.getId());
        photo.setS3ObjectKey(s3Key);
        photo.setShotAt(LocalDateTime.of(2026, 3, 1, 12, 0));
        photo.setModerationStatus(status);
        return photoRepository.save(photo);
    }
}
