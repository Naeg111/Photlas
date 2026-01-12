package com.photlas.backend.service;

import com.photlas.backend.dto.ReportRequest;
import com.photlas.backend.dto.ReportResponse;
import com.photlas.backend.entity.Report;
import com.photlas.backend.entity.ReportReason;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.repository.ReportRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issue#19: レポートサービス
 */
@Service
public class ReportService {

    private final ReportRepository reportRepository;

    public ReportService(ReportRepository reportRepository) {
        this.reportRepository = reportRepository;
    }

    /**
     * レポートを作成する
     * 同じユーザーが同じ写真を再度報告した場合はConflictExceptionをスロー
     *
     * @param photoId 写真ID
     * @param request レポート作成リクエスト
     * @param userId 報告ユーザーID
     * @return ReportResponse
     * @throws ConflictException すでに報告済みの場合
     */
    @Transactional
    public ReportResponse createReport(Long photoId, ReportRequest request, Long userId) {
        // 重複チェック
        reportRepository.findByReportingUserIdAndPhotoId(userId, photoId)
                .ifPresent(report -> {
                    throw new ConflictException("この写真はすでに報告済みです");
                });

        // Report entityを作成
        Report report = new Report();
        report.setReportingUserId(userId);
        report.setPhotoId(photoId);
        report.setReason(ReportReason.valueOf(request.getReason()));
        report.setDetails(request.getDetails());

        // 保存
        Report savedReport = reportRepository.save(report);

        // レスポンスを作成
        return new ReportResponse(
                savedReport.getReportingUserId(),
                savedReport.getPhotoId(),
                savedReport.getReason().name(),
                savedReport.getDetails()
        );
    }
}
