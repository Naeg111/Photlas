package com.photlas.backend.service;

import com.photlas.backend.dto.ReportRequest;
import com.photlas.backend.dto.ReportResponse;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Report;
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

        // Issue#54: 公開中の写真のみ通報可能
        if (!Integer.valueOf(CodeConstants.MODERATION_STATUS_PUBLISHED).equals(photo.getModerationStatus())) {
            throw new IllegalStateException("公開中の写真のみ通報できます");
        }

        // Issue#54: 自分の投稿は通報できない
        if (photo.getUserId().equals(userId)) {
            throw new SelfReportException("自分の投稿を通報することはできません");
        }

        Report savedReport = saveReport(userId, CodeConstants.TARGET_TYPE_PHOTO, photoId, request);

        // Issue#54: 通報件数が閾値に達したらQUARANTINEDに変更
        long reportCount = reportRepository.countByTargetTypeAndTargetId(
                CodeConstants.TARGET_TYPE_PHOTO, photoId);
        if (reportCount >= QUARANTINE_THRESHOLD
                && Integer.valueOf(CodeConstants.MODERATION_STATUS_PUBLISHED).equals(photo.getModerationStatus())) {
            photo.setModerationStatus(CodeConstants.MODERATION_STATUS_QUARANTINED);
            photoRepository.save(photo);
            logger.info("通報件数が閾値に達したため写真を隔離: photoId={}, reportCount={}",
                    photoId, reportCount);
        }

        logger.info("通報を受け付けました: photoId={}, reporterUserId={}, reason={}",
                photoId, userId, request.getReason());

        return toResponse(savedReport);
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

        Report savedReport = saveReport(reporterUserId, CodeConstants.TARGET_TYPE_PROFILE, targetUserId, request);

        // 通報件数が閾値に達したらプロフィール画像をリセット
        long reportCount = reportRepository.countByTargetTypeAndTargetId(
                CodeConstants.TARGET_TYPE_PROFILE, targetUserId);
        if (reportCount >= QUARANTINE_THRESHOLD && targetUser.getProfileImageS3Key() != null) {
            targetUser.setProfileImageS3Key(null);
            userRepository.save(targetUser);
            logger.info("通報件数が閾値に達したためプロフィール画像をリセット: userId={}, reportCount={}",
                    targetUserId, reportCount);
        }

        logger.info("プロフィール通報を受け付けました: targetUserId={}, reporterUserId={}, reason={}",
                targetUserId, reporterUserId, request.getReason());

        return toResponse(savedReport);
    }

    /**
     * 通報の重複チェック・保存を行う共通メソッド
     */
    private Report saveReport(Long reporterUserId, int targetType,
                              Long targetId, ReportRequest request) {
        reportRepository.findByReporterUserIdAndTargetTypeAndTargetId(
                reporterUserId, targetType, targetId)
                .ifPresent(report -> {
                    throw new ConflictException("すでに通報済みです");
                });

        Report report = new Report();
        report.setReporterUserId(reporterUserId);
        report.setTargetType(targetType);
        report.setTargetId(targetId);
        report.setReasonCategory(request.getReason());
        report.setReasonText(request.getDetails());

        return reportRepository.save(report);
    }

    private ReportResponse toResponse(Report report) {
        return new ReportResponse(
                report.getReporterUserId(),
                report.getTargetId(),
                mapCodeToReasonName(report.getReasonCategory()),
                report.getReasonText()
        );
    }

    /**
     * 違反理由文字列を数値コードに変換する
     */
    private int mapReasonToCode(String reason) {
        return switch (reason) {
            case "ADULT_CONTENT" -> CodeConstants.REASON_ADULT_CONTENT;
            case "VIOLENCE" -> CodeConstants.REASON_VIOLENCE;
            case "COPYRIGHT_INFRINGEMENT" -> CodeConstants.REASON_COPYRIGHT_INFRINGEMENT;
            case "PRIVACY_VIOLATION" -> CodeConstants.REASON_PRIVACY_VIOLATION;
            case "SPAM" -> CodeConstants.REASON_SPAM;
            case "OTHER" -> CodeConstants.REASON_OTHER;
            default -> throw new IllegalArgumentException("不明な通報理由: " + reason);
        };
    }

    /**
     * 数値コードを理由文字列に変換する（レスポンス用）
     */
    private String mapCodeToReasonName(int code) {
        return switch (code) {
            case CodeConstants.REASON_ADULT_CONTENT -> "ADULT_CONTENT";
            case CodeConstants.REASON_VIOLENCE -> "VIOLENCE";
            case CodeConstants.REASON_COPYRIGHT_INFRINGEMENT -> "COPYRIGHT_INFRINGEMENT";
            case CodeConstants.REASON_PRIVACY_VIOLATION -> "PRIVACY_VIOLATION";
            case CodeConstants.REASON_SPAM -> "SPAM";
            case CodeConstants.REASON_OTHER -> "OTHER";
            default -> throw new IllegalArgumentException("不明な理由コード: " + code);
        };
    }
}
