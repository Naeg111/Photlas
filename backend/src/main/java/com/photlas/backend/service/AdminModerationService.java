package com.photlas.backend.service;

import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.ReportTargetType;
import com.photlas.backend.entity.Violation;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.ReportRepository;
import com.photlas.backend.repository.ViolationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Issue#54: 管理者モデレーションサービス
 * 隔離画像の承認・拒否操作を提供する
 */
@Service
public class AdminModerationService {

    private static final Logger logger = LoggerFactory.getLogger(AdminModerationService.class);

    private final PhotoRepository photoRepository;
    private final ViolationRepository violationRepository;
    private final ReportRepository reportRepository;

    public AdminModerationService(
            PhotoRepository photoRepository,
            ViolationRepository violationRepository,
            ReportRepository reportRepository
    ) {
        this.photoRepository = photoRepository;
        this.violationRepository = violationRepository;
        this.reportRepository = reportRepository;
    }

    /**
     * 写真を承認する（問題なし判定）
     * ステータスをPUBLISHEDに戻す
     *
     * @param photoId 写真ID
     * @throws PhotoNotFoundException 写真が見つからない場合
     */
    @Transactional
    public void approvePhoto(Long photoId) {
        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new PhotoNotFoundException("写真が見つかりません"));

        photo.setModerationStatus(ModerationStatus.PUBLISHED);
        photoRepository.save(photo);

        logger.info("写真を承認しました: photoId={}", photoId);
    }

    /**
     * 写真を拒否する（違反あり判定）
     * ステータスをREMOVEDに変更し、違反履歴を作成する
     *
     * @param photoId 写真ID
     * @param reason 違反理由
     * @throws PhotoNotFoundException 写真が見つからない場合
     */
    @Transactional
    public void rejectPhoto(Long photoId, String reason) {
        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new PhotoNotFoundException("写真が見つかりません"));

        // ステータスをREMOVEDに変更
        photo.setModerationStatus(ModerationStatus.REMOVED);
        photoRepository.save(photo);

        // 違反履歴を作成
        Violation violation = new Violation();
        violation.setUserId(photo.getUserId());
        violation.setTargetType(ReportTargetType.PHOTO);
        violation.setTargetId(photoId);
        violation.setViolationType(reason);
        violation.setActionTaken("REMOVED");
        violationRepository.save(violation);

        logger.info("写真を拒否しました: photoId={}, userId={}, reason={}",
                photoId, photo.getUserId(), reason);
    }

    /**
     * ユーザーの違反回数を取得する
     *
     * @param userId ユーザーID
     * @return 違反回数
     */
    @Transactional(readOnly = true)
    public long getViolationCount(Long userId) {
        return violationRepository.countByUserId(userId);
    }
}
