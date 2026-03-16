package com.photlas.backend.service;

import com.photlas.backend.dto.ReportRequest;
import com.photlas.backend.dto.ReportResponse;
import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Report;
import com.photlas.backend.entity.ReportReason;
import com.photlas.backend.entity.ReportTargetType;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.exception.SelfReportException;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.ReportRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Issue#54: ReportServiceのユニットテスト
 */
@ExtendWith(MockitoExtension.class)
public class ReportServiceTest {

    @Mock
    private PhotoRepository photoRepository;

    @Mock
    private ReportRepository reportRepository;

    @InjectMocks
    private ReportService reportService;

    private static final Long TEST_PHOTO_ID = 10L;
    private static final Long TEST_REPORTER_USER_ID = 2L;
    private static final Long TEST_PHOTO_OWNER_USER_ID = 1L;

    /**
     * テスト用Photoエンティティを作成する
     */
    private Photo createTestPhoto() {
        Photo photo = new Photo();
        photo.setPhotoId(TEST_PHOTO_ID);
        photo.setUserId(TEST_PHOTO_OWNER_USER_ID);
        photo.setModerationStatus(ModerationStatus.PUBLISHED);
        return photo;
    }

    /**
     * テスト用ReportRequestを作成する
     */
    private ReportRequest createTestReportRequest() {
        return new ReportRequest("SPAM", "スパム投稿です");
    }

    /**
     * テスト用の保存後Reportエンティティを作成する
     */
    private Report createSavedReport() {
        Report report = new Report();
        report.setId(1L);
        report.setReporterUserId(TEST_REPORTER_USER_ID);
        report.setTargetType(ReportTargetType.PHOTO);
        report.setTargetId(TEST_PHOTO_ID);
        report.setReasonCategory(ReportReason.SPAM);
        report.setReasonText("スパム投稿です");
        return report;
    }

    @Test
    @DisplayName("Issue#54 - 自分の投稿を通報するとSelfReportExceptionがスローされる")
    void createReport_SelfReport_ThrowsSelfReportException() {
        // Given
        Photo photo = createTestPhoto();
        when(photoRepository.findById(TEST_PHOTO_ID)).thenReturn(Optional.of(photo));
        ReportRequest request = createTestReportRequest();

        // When & Then: 投稿者自身が通報
        assertThatThrownBy(() -> reportService.createReport(TEST_PHOTO_ID, request, TEST_PHOTO_OWNER_USER_ID))
                .isInstanceOf(SelfReportException.class)
                .hasMessageContaining("自分の投稿を通報することはできません");
    }

    @Test
    @DisplayName("Issue#54 - 重複通報するとConflictExceptionがスローされる")
    void createReport_DuplicateReport_ThrowsConflictException() {
        // Given
        Photo photo = createTestPhoto();
        when(photoRepository.findById(TEST_PHOTO_ID)).thenReturn(Optional.of(photo));

        Report existingReport = createSavedReport();
        when(reportRepository.findByReporterUserIdAndTargetTypeAndTargetId(
                TEST_REPORTER_USER_ID, ReportTargetType.PHOTO, TEST_PHOTO_ID))
                .thenReturn(Optional.of(existingReport));

        ReportRequest request = createTestReportRequest();

        // When & Then
        assertThatThrownBy(() -> reportService.createReport(TEST_PHOTO_ID, request, TEST_REPORTER_USER_ID))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("この写真はすでに通報済みです");
    }

    @Test
    @DisplayName("Issue#54 - 存在しない写真を通報するとPhotoNotFoundExceptionがスローされる")
    void createReport_PhotoNotFound_ThrowsPhotoNotFoundException() {
        // Given
        when(photoRepository.findById(TEST_PHOTO_ID)).thenReturn(Optional.empty());
        ReportRequest request = createTestReportRequest();

        // When & Then
        assertThatThrownBy(() -> reportService.createReport(TEST_PHOTO_ID, request, TEST_REPORTER_USER_ID))
                .isInstanceOf(PhotoNotFoundException.class)
                .hasMessageContaining("写真が見つかりません");
    }

    @Test
    @DisplayName("Issue#54 - 通報件数が閾値(2)に達すると写真がQUARANTINEDになる")
    void createReport_ReportCountReachesThreshold_PhotoQuarantined() {
        // Given
        Photo photo = createTestPhoto();
        when(photoRepository.findById(TEST_PHOTO_ID)).thenReturn(Optional.of(photo));
        when(reportRepository.findByReporterUserIdAndTargetTypeAndTargetId(
                TEST_REPORTER_USER_ID, ReportTargetType.PHOTO, TEST_PHOTO_ID))
                .thenReturn(Optional.empty());

        Report savedReport = createSavedReport();
        when(reportRepository.save(any(Report.class))).thenReturn(savedReport);

        // 閾値の2件に到達
        when(reportRepository.countByTargetTypeAndTargetId(ReportTargetType.PHOTO, TEST_PHOTO_ID))
                .thenReturn(2L);

        ReportRequest request = createTestReportRequest();

        // When
        reportService.createReport(TEST_PHOTO_ID, request, TEST_REPORTER_USER_ID);

        // Then
        assertThat(photo.getModerationStatus()).isEqualTo(ModerationStatus.QUARANTINED);
        verify(photoRepository).save(photo);
    }

    @Test
    @DisplayName("Issue#54 - 通報件数が閾値未満の場合写真ステータスは変更されない")
    void createReport_ReportCountBelowThreshold_StatusNotChanged() {
        // Given
        Photo photo = createTestPhoto();
        when(photoRepository.findById(TEST_PHOTO_ID)).thenReturn(Optional.of(photo));
        when(reportRepository.findByReporterUserIdAndTargetTypeAndTargetId(
                TEST_REPORTER_USER_ID, ReportTargetType.PHOTO, TEST_PHOTO_ID))
                .thenReturn(Optional.empty());

        Report savedReport = createSavedReport();
        when(reportRepository.save(any(Report.class))).thenReturn(savedReport);

        // 閾値の2件未満
        when(reportRepository.countByTargetTypeAndTargetId(ReportTargetType.PHOTO, TEST_PHOTO_ID))
                .thenReturn(1L);

        ReportRequest request = createTestReportRequest();

        // When
        reportService.createReport(TEST_PHOTO_ID, request, TEST_REPORTER_USER_ID);

        // Then
        assertThat(photo.getModerationStatus()).isEqualTo(ModerationStatus.PUBLISHED);
        verify(photoRepository, never()).save(any(Photo.class));
    }

    @Test
    @DisplayName("Issue#54 - 既にQUARANTINEDの写真は再隔離されない")
    void createReport_AlreadyQuarantined_NotReQuarantined() {
        // Given
        Photo photo = createTestPhoto();
        photo.setModerationStatus(ModerationStatus.QUARANTINED);
        when(photoRepository.findById(TEST_PHOTO_ID)).thenReturn(Optional.of(photo));
        when(reportRepository.findByReporterUserIdAndTargetTypeAndTargetId(
                TEST_REPORTER_USER_ID, ReportTargetType.PHOTO, TEST_PHOTO_ID))
                .thenReturn(Optional.empty());

        Report savedReport = createSavedReport();
        when(reportRepository.save(any(Report.class))).thenReturn(savedReport);

        // 閾値以上だがステータスがQUARANTINED
        when(reportRepository.countByTargetTypeAndTargetId(ReportTargetType.PHOTO, TEST_PHOTO_ID))
                .thenReturn(3L);

        ReportRequest request = createTestReportRequest();

        // When
        reportService.createReport(TEST_PHOTO_ID, request, TEST_REPORTER_USER_ID);

        // Then: photoRepository.save は呼ばれない（ステータスがPUBLISHEDでないため条件不一致）
        verify(photoRepository, never()).save(any(Photo.class));
    }

    @Test
    @DisplayName("Issue#54 - 正常な通報で正しいReportResponseが返される")
    void createReport_ValidReport_ReturnsCorrectResponse() {
        // Given
        Photo photo = createTestPhoto();
        when(photoRepository.findById(TEST_PHOTO_ID)).thenReturn(Optional.of(photo));
        when(reportRepository.findByReporterUserIdAndTargetTypeAndTargetId(
                TEST_REPORTER_USER_ID, ReportTargetType.PHOTO, TEST_PHOTO_ID))
                .thenReturn(Optional.empty());

        Report savedReport = createSavedReport();
        when(reportRepository.save(any(Report.class))).thenReturn(savedReport);
        when(reportRepository.countByTargetTypeAndTargetId(ReportTargetType.PHOTO, TEST_PHOTO_ID))
                .thenReturn(1L);

        ReportRequest request = createTestReportRequest();

        // When
        ReportResponse response = reportService.createReport(TEST_PHOTO_ID, request, TEST_REPORTER_USER_ID);

        // Then
        assertThat(response.getReportingUserId()).isEqualTo(TEST_REPORTER_USER_ID);
        assertThat(response.getPhotoId()).isEqualTo(TEST_PHOTO_ID);
        assertThat(response.getReason()).isEqualTo("SPAM");
        assertThat(response.getDetails()).isEqualTo("スパム投稿です");
    }
}
