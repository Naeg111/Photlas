package com.photlas.backend.service;

import com.photlas.backend.entity.AccountSanction;
import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.ReportTargetType;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.Violation;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.repository.AccountSanctionRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.ReportRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.repository.ViolationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/**
 * Issue#54: 管理者モデレーションサービス
 * 隔離画像の承認・拒否操作を提供する
 */
@Service
public class AdminModerationService {

    private static final Logger logger = LoggerFactory.getLogger(AdminModerationService.class);

    private static final String SANCTION_WARNING = "WARNING";
    private static final String SANCTION_TEMPORARY_SUSPENSION = "TEMPORARY_SUSPENSION";
    private static final String SANCTION_PERMANENT_SUSPENSION = "PERMANENT_SUSPENSION";
    private static final String ROLE_SUSPENDED = "SUSPENDED";
    private static final int TEMPORARY_SUSPENSION_DAYS = 60;

    private final PhotoRepository photoRepository;
    private final ViolationRepository violationRepository;
    private final ReportRepository reportRepository;
    private final AccountSanctionRepository accountSanctionRepository;
    private final UserRepository userRepository;

    public AdminModerationService(
            PhotoRepository photoRepository,
            ViolationRepository violationRepository,
            ReportRepository reportRepository,
            AccountSanctionRepository accountSanctionRepository,
            UserRepository userRepository
    ) {
        this.photoRepository = photoRepository;
        this.violationRepository = violationRepository;
        this.reportRepository = reportRepository;
        this.accountSanctionRepository = accountSanctionRepository;
        this.userRepository = userRepository;
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
     * ステータスをREMOVEDに変更し、違反履歴を作成し、アカウント制裁を適用する
     *
     * @param photoId 写真ID
     * @param reason 違反理由
     * @throws PhotoNotFoundException 写真が見つからない場合
     */
    @Transactional
    public void rejectPhoto(Long photoId, String reason) {
        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new PhotoNotFoundException("写真が見つかりません"));

        Long userId = photo.getUserId();

        // ステータスをREMOVEDに変更
        photo.setModerationStatus(ModerationStatus.REMOVED);
        photoRepository.save(photo);

        // 違反履歴を作成
        Violation violation = new Violation();
        violation.setUserId(userId);
        violation.setTargetType(ReportTargetType.PHOTO);
        violation.setTargetId(photoId);
        violation.setViolationType(reason);
        violation.setActionTaken("REMOVED");
        violationRepository.save(violation);

        // アカウント制裁を適用
        long violationCount = violationRepository.countByUserId(userId);
        applySanction(userId, violationCount, reason);

        logger.info("写真を拒否しました: photoId={}, userId={}, reason={}, violationCount={}",
                photoId, userId, reason, violationCount);
    }

    /**
     * 違反回数に応じたアカウント制裁を適用する
     *
     * @param userId ユーザーID
     * @param violationCount 違反回数（現在の違反を含む）
     * @param reason 違反理由
     */
    private void applySanction(Long userId, long violationCount, String reason) {
        AccountSanction sanction = new AccountSanction();
        sanction.setUserId(userId);
        sanction.setReason(reason);

        if (violationCount >= 3) {
            // 3回目以降: 永久停止
            sanction.setSanctionType(SANCTION_PERMANENT_SUSPENSION);
            accountSanctionRepository.save(sanction);
            applyPermanentSuspension(userId);
        } else if (violationCount == 2) {
            // 2回目: 60日間投稿停止
            sanction.setSanctionType(SANCTION_TEMPORARY_SUSPENSION);
            sanction.setSuspendedUntil(LocalDateTime.now().plusDays(TEMPORARY_SUSPENSION_DAYS));
            accountSanctionRepository.save(sanction);
            logger.info("一時停止を適用: userId={}, until={}", userId, sanction.getSuspendedUntil());
        } else {
            // 1回目: 警告
            sanction.setSanctionType(SANCTION_WARNING);
            accountSanctionRepository.save(sanction);
            logger.info("警告を適用: userId={}", userId);
        }
    }

    /**
     * アカウントを永久停止する
     * ユーザーのロールをSUSPENDEDに変更し、全公開写真をREMOVEDにする
     *
     * @param userId ユーザーID
     */
    private void applyPermanentSuspension(Long userId) {
        // ユーザーロールをSUSPENDEDに変更
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            user.setRole(ROLE_SUSPENDED);
            userRepository.save(user);
        }

        // 公開中・審査待ちの写真を全てREMOVEDにする（既にREMOVED/QUARANTINEDのものは除く）
        List<ModerationStatus> activeStatuses = Arrays.asList(
                ModerationStatus.PUBLISHED, ModerationStatus.PENDING_REVIEW
        );
        var photosPage = photoRepository.findByUserIdAndModerationStatusInOrderByCreatedAtDesc(
                userId, activeStatuses, PageRequest.of(0, Integer.MAX_VALUE)
        );
        for (Photo photo : photosPage.getContent()) {
            photo.setModerationStatus(ModerationStatus.REMOVED);
            photoRepository.save(photo);
        }

        logger.info("永久停止を適用: userId={}, removedPhotos={}", userId, photosPage.getTotalElements());
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
