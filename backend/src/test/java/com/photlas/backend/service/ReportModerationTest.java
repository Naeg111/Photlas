package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.dto.ReportRequest;
import com.photlas.backend.dto.ReportResponse;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.SelfReportException;
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
 * Issue#54: 通報によるモデレーション連携テスト
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class ReportModerationTest {

    @Autowired
    private ReportService reportService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private ReportRepository reportRepository;

    private User photoOwner;
    private User reporter1;
    private User reporter2;
    private Photo testPhoto;

    @BeforeEach
    void setUp() {
        reportRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();

        photoOwner = createUser("owner", "owner@example.com");
        reporter1 = createUser("reporter1", "reporter1@example.com");
        reporter2 = createUser("reporter2", "reporter2@example.com");

        Spot spot = createSpot();
        testPhoto = createPhoto(spot);
    }

    @Test
    @DisplayName("Issue#54 - 自分の投稿を通報できない")
    void testCreateReport_SelfReport_ThrowsException() {
        ReportRequest request = new ReportRequest(CodeConstants.REASON_ADULT_CONTENT, "テスト");

        assertThatThrownBy(() ->
                reportService.createReport(testPhoto.getPhotoId(), request, photoOwner.getId())
        ).isInstanceOf(SelfReportException.class);
    }

    @Test
    @DisplayName("Issue#54 - 1件目の通報ではステータスがPUBLISHEDのまま")
    void testCreateReport_FirstReport_StatusRemainsPublished() {
        ReportRequest request = new ReportRequest(CodeConstants.REASON_ADULT_CONTENT, "不適切な画像です");

        reportService.createReport(testPhoto.getPhotoId(), request, reporter1.getId());

        Photo updatedPhoto = photoRepository.findById(testPhoto.getPhotoId()).orElseThrow();
        assertThat(updatedPhoto.getModerationStatus()).isEqualTo(CodeConstants.MODERATION_STATUS_PUBLISHED);
    }

    @Test
    @DisplayName("Issue#54 - 異なるユーザーからの通報が2件で写真がQUARANTINEDになる")
    void testCreateReport_TwoReportsFromDifferentUsers_StatusBecomesQuarantined() {
        ReportRequest request1 = new ReportRequest(CodeConstants.REASON_ADULT_CONTENT, "不適切な画像です");
        ReportRequest request2 = new ReportRequest(CodeConstants.REASON_VIOLENCE, "暴力的な内容です");

        reportService.createReport(testPhoto.getPhotoId(), request1, reporter1.getId());
        reportService.createReport(testPhoto.getPhotoId(), request2, reporter2.getId());

        Photo updatedPhoto = photoRepository.findById(testPhoto.getPhotoId()).orElseThrow();
        assertThat(updatedPhoto.getModerationStatus()).isEqualTo(CodeConstants.MODERATION_STATUS_QUARANTINED);
    }

    @Test
    @DisplayName("Issue#54 - 新しい通報理由カテゴリが使用できる")
    void testCreateReport_NewReasonCategories_Accepted() {
        ReportRequest request = new ReportRequest(CodeConstants.REASON_SPAM, "スパム投稿です");

        ReportResponse response = reportService.createReport(
                testPhoto.getPhotoId(), request, reporter1.getId());

        assertThat(response).isNotNull();
        assertThat(response.getReason()).isEqualTo("SPAM");
    }

    @Test
    @DisplayName("Issue#54 - 同じユーザーが同じ写真を2回通報するとConflictExceptionが発生する")
    void testCreateReport_DuplicateReport_ThrowsConflictException() {
        ReportRequest request1 = new ReportRequest(CodeConstants.REASON_ADULT_CONTENT, "不適切な画像です");
        ReportRequest request2 = new ReportRequest(CodeConstants.REASON_VIOLENCE, "暴力的な内容です");

        reportService.createReport(testPhoto.getPhotoId(), request1, reporter1.getId());

        assertThatThrownBy(() ->
                reportService.createReport(testPhoto.getPhotoId(), request2, reporter1.getId())
        ).isInstanceOf(ConflictException.class);
    }

    @Test
    @DisplayName("Issue#54 - すでにQUARANTINEDの写真への通報はIllegalStateExceptionがスローされる")
    void testCreateReport_AlreadyQuarantined_ThrowsIllegalStateException() {
        // Given: 写真を事前にQUARANTINEDに設定
        testPhoto.setModerationStatus(CodeConstants.MODERATION_STATUS_QUARANTINED);
        photoRepository.save(testPhoto);

        ReportRequest request = new ReportRequest(CodeConstants.REASON_ADULT_CONTENT, "不適切");

        // When & Then: 公開中でない写真への通報はブロックされる
        assertThatThrownBy(() -> reportService.createReport(
                testPhoto.getPhotoId(), request, reporter1.getId()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("公開中の写真のみ");
    }

    // ===== Issue#54: S3隔離フロー整合性テスト =====

    @Test
    @DisplayName("Issue#54 - 通報2件でQUARANTINED時にs3_object_keyがquarantined/プレフィックス付きに更新される")
    void testCreateReport_TwoReports_S3ObjectKeyUpdated() {
        ReportRequest request1 = new ReportRequest(CodeConstants.REASON_ADULT_CONTENT, "不適切");
        ReportRequest request2 = new ReportRequest(CodeConstants.REASON_VIOLENCE, "暴力的");

        reportService.createReport(testPhoto.getPhotoId(), request1, reporter1.getId());
        reportService.createReport(testPhoto.getPhotoId(), request2, reporter2.getId());

        Photo updatedPhoto = photoRepository.findById(testPhoto.getPhotoId()).orElseThrow();
        assertThat(updatedPhoto.getS3ObjectKey()).startsWith("quarantined/");
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

    private Photo createPhoto(Spot spot) {
        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(photoOwner.getId());
        photo.setS3ObjectKey("photos/report-test.jpg");
        photo.setShotAt(LocalDateTime.of(2026, 3, 1, 12, 0));
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        return photoRepository.save(photo);
    }
}
