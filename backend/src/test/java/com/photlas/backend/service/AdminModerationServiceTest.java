package com.photlas.backend.service;

import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.ReportRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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

    private User photoOwner;
    private Spot testSpot;

    @BeforeEach
    void setUp() {
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
        Photo photo = createPhotoWithStatus("photos/approve001.jpg", ModerationStatus.QUARANTINED);

        adminModerationService.approvePhoto(photo.getPhotoId());

        Photo updated = photoRepository.findById(photo.getPhotoId()).orElseThrow();
        assertThat(updated.getModerationStatus()).isEqualTo(ModerationStatus.PUBLISHED);
    }

    @Test
    @DisplayName("Issue#54 - 隔離中の写真を「違反あり」にするとREMOVEDになる")
    void testRejectPhoto_QuarantinedPhoto_BecomesRemoved() {
        Photo photo = createPhotoWithStatus("photos/reject001.jpg", ModerationStatus.QUARANTINED);

        adminModerationService.rejectPhoto(photo.getPhotoId(), "利用規約違反");

        Photo updated = photoRepository.findById(photo.getPhotoId()).orElseThrow();
        assertThat(updated.getModerationStatus()).isEqualTo(ModerationStatus.REMOVED);
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
        Photo photo = createPhotoWithStatus("photos/violation001.jpg", ModerationStatus.QUARANTINED);

        adminModerationService.rejectPhoto(photo.getPhotoId(), "不適切なコンテンツ");

        // 違反履歴が1件作成されること
        long violationCount = adminModerationService.getViolationCount(photoOwner.getId());
        assertThat(violationCount).isEqualTo(1);
    }

    // ===== テストヘルパーメソッド =====

    private User createUser(String username, String email) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash("hashedpassword");
        user.setRole("USER");
        return userRepository.save(user);
    }

    private Spot createSpot() {
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(photoOwner.getId());
        return spotRepository.save(spot);
    }

    private Photo createPhotoWithStatus(String s3Key, ModerationStatus status) {
        Photo photo = new Photo();
        photo.setSpotId(testSpot.getSpotId());
        photo.setUserId(photoOwner.getId());
        photo.setS3ObjectKey(s3Key);
        photo.setTitle("管理者テスト写真");
        photo.setShotAt(LocalDateTime.of(2026, 3, 1, 12, 0));
        photo.setModerationStatus(status);
        return photoRepository.save(photo);
    }
}
