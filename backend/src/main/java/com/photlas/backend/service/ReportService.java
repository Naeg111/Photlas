package com.photlas.backend.service;

import com.photlas.backend.dto.ReportRequest;
import com.photlas.backend.dto.ReportResponse;
import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Report;
import com.photlas.backend.entity.ReportReason;
import com.photlas.backend.entity.ReportTargetType;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.exception.SelfReportException;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.ReportRepository;
import com.photlas.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issue#54: 通報サービス
 */
@Service
public class ReportService {

    private static final Logger logger = LoggerFactory.getLogger(ReportService.class);

    /** 自動隔離に必要な通報件数の閾値 */
    private static final long QUARANTINE_THRESHOLD = 2;

    private final ReportRepository reportRepository;
    private final PhotoRepository photoRepository;
    private final UserRepository userRepository;

    public ReportService(ReportRepository reportRepository, PhotoRepository photoRepository,
                         UserRepository userRepository) {
        this.reportRepository = reportRepository;
        this.photoRepository = photoRepository;
        this.userRepository = userRepository;
    }

    /**
     * 写真を通報する
     *
     * @param photoId 写真ID
     * @param request 通報リクエスト
     * @param userId 通報ユーザーID
     * @return ReportResponse
     * @throws SelfReportException 自分の投稿を通報した場合
     * @throws ConflictException すでに通報済みの場合
     * @throws PhotoNotFoundException 写真が見つからない場合
     */
    @Transactional
    public ReportResponse createReport(Long photoId, ReportRequest request, Long userId) {
        // 写真の存在確認
        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new PhotoNotFoundException("写真が見つかりません"));

        // Issue#54: 自分の投稿は通報できない
        if (photo.getUserId().equals(userId)) {
            throw new SelfReportException("自分の投稿を通報することはできません");
        }

        // 重複チェック
        reportRepository.findByReporterUserIdAndTargetTypeAndTargetId(
                userId, ReportTargetType.PHOTO, photoId)
                .ifPresent(report -> {
                    throw new ConflictException("この写真はすでに通報済みです");
                });

        // Report entityを作成
        Report report = new Report();
        report.setReporterUserId(userId);
        report.setTargetType(ReportTargetType.PHOTO);
        report.setTargetId(photoId);
        report.setReasonCategory(ReportReason.valueOf(request.getReason()));
        report.setReasonText(request.getDetails());

        Report savedReport = reportRepository.save(report);

        // Issue#54: 通報件数が閾値に達したらQUARANTINEDに変更
        long reportCount = reportRepository.countByTargetTypeAndTargetId(
                ReportTargetType.PHOTO, photoId);
        if (reportCount >= QUARANTINE_THRESHOLD
                && photo.getModerationStatus() == ModerationStatus.PUBLISHED) {
            photo.setModerationStatus(ModerationStatus.QUARANTINED);
            photoRepository.save(photo);
            logger.info("通報件数が閾値に達したため写真を隔離: photoId={}, reportCount={}",
                    photoId, reportCount);
        }

        logger.info("通報を受け付けました: photoId={}, reporterUserId={}, reason={}",
                photoId, userId, request.getReason());

        return new ReportResponse(
                savedReport.getReporterUserId(),
                savedReport.getTargetId(),
                savedReport.getReasonCategory().name(),
                savedReport.getReasonText()
        );
    }

    /**
     * Issue#54: プロフィールを通報する
     *
     * @param targetUserId 通報対象ユーザーID
     * @param request 通報リクエスト
     * @param reporterUserId 通報ユーザーID
     * @return ReportResponse
     */
    @Transactional
    public ReportResponse createProfileReport(Long targetUserId, ReportRequest request, Long reporterUserId) {
        // 対象ユーザーの存在確認
        User targetUser = userRepository.findById(targetUserId)
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません"));

        // 自分のプロフィールは通報できない
        if (targetUser.getId().equals(reporterUserId)) {
            throw new SelfReportException("自分のプロフィールを通報することはできません");
        }

        // 重複チェック
        reportRepository.findByReporterUserIdAndTargetTypeAndTargetId(
                reporterUserId, ReportTargetType.PROFILE, targetUserId)
                .ifPresent(report -> {
                    throw new ConflictException("このプロフィールはすでに通報済みです");
                });

        // Report entityを作成
        Report report = new Report();
        report.setReporterUserId(reporterUserId);
        report.setTargetType(ReportTargetType.PROFILE);
        report.setTargetId(targetUserId);
        report.setReasonCategory(ReportReason.valueOf(request.getReason()));
        report.setReasonText(request.getDetails());

        Report savedReport = reportRepository.save(report);

        // 通報件数が閾値に達したらプロフィール画像をリセット
        long reportCount = reportRepository.countByTargetTypeAndTargetId(
                ReportTargetType.PROFILE, targetUserId);
        if (reportCount >= QUARANTINE_THRESHOLD && targetUser.getProfileImageS3Key() != null) {
            targetUser.setProfileImageS3Key(null);
            userRepository.save(targetUser);
            logger.info("通報件数が閾値に達したためプロフィール画像をリセット: userId={}, reportCount={}",
                    targetUserId, reportCount);
        }

        logger.info("プロフィール通報を受け付けました: targetUserId={}, reporterUserId={}, reason={}",
                targetUserId, reporterUserId, request.getReason());

        return new ReportResponse(
                savedReport.getReporterUserId(),
                savedReport.getTargetId(),
                savedReport.getReasonCategory().name(),
                savedReport.getReasonText()
        );
    }
}
