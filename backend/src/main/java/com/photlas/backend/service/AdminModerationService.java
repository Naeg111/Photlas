package com.photlas.backend.service;

import com.photlas.backend.entity.AccountSanction;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.ModerationDetail;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Report;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.Violation;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.repository.AccountSanctionRepository;
import com.photlas.backend.repository.ModerationDetailRepository;
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
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Issue#54: 管理者モデレーションサービス
 * 隔離画像の承認・拒否操作を提供する
 */
@Service
public class AdminModerationService {

    private static final Logger logger = LoggerFactory.getLogger(AdminModerationService.class);

    private static final int TEMPORARY_SUSPENSION_DAYS = 60;

    private static final Set<String> ADULT_CONTENT_LABELS = Set.of(
            "Explicit Nudity", "Explicit Sexual Activity",
            "Exposed Male Genitalia", "Exposed Female Genitalia",
            "Exposed Buttocks or Anus", "Exposed Female Nipple"
    );

    private static final Set<String> VIOLENCE_LABELS = Set.of(
            "Violence", "Graphic Violence", "Visually Disturbing"
    );

    private final PhotoRepository photoRepository;
    private final ViolationRepository violationRepository;
    private final AccountSanctionRepository accountSanctionRepository;
    private final UserRepository userRepository;
    private final ReportRepository reportRepository;
    private final ModerationDetailRepository moderationDetailRepository;
    private final ModerationNotificationService notificationService;
    private final QuarantineService quarantineService;

    public AdminModerationService(
            PhotoRepository photoRepository,
            ViolationRepository violationRepository,
            AccountSanctionRepository accountSanctionRepository,
            UserRepository userRepository,
            ReportRepository reportRepository,
            ModerationDetailRepository moderationDetailRepository,
            ModerationNotificationService notificationService,
            QuarantineService quarantineService
    ) {
        this.photoRepository = photoRepository;
        this.violationRepository = violationRepository;
        this.accountSanctionRepository = accountSanctionRepository;
        this.userRepository = userRepository;
        this.reportRepository = reportRepository;
        this.moderationDetailRepository = moderationDetailRepository;
        this.notificationService = notificationService;
        this.quarantineService = quarantineService;
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

        // Issue#54: S3ファイルをquarantined/から元の場所に復元
        if (quarantineService.isQuarantined(photo.getS3ObjectKey())) {
            quarantineService.restorePhoto(photo);
        }

        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
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
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_REMOVED);
        photoRepository.save(photo);

        // 違反履歴を作成（violationTypeを通報理由/AI検出ラベルから決定）
        Violation violation = new Violation();
        violation.setUserId(userId);
        violation.setTargetType(CodeConstants.TARGET_TYPE_PHOTO);
        violation.setTargetId(photoId);
        violation.setViolationType(determineViolationType(photoId));
        violation.setActionTaken(CodeConstants.ACTION_TAKEN_REMOVED);
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

        User user = userRepository.findById(userId).orElse(null);
        String email = user != null ? user.getEmail() : null;
        String username = user != null ? user.getUsername() : null;

        if (violationCount >= 3) {
            // 3回目以降: 永久停止
            sanction.setSanctionType(CodeConstants.SANCTION_PERMANENT_SUSPENSION);
            accountSanctionRepository.save(sanction);
            applyPermanentSuspension(userId);
            if (email != null) {
                notificationService.sendPermanentSuspensionNotification(email, username, reason);
            }
        } else if (violationCount == 2) {
            // 2回目: 60日間投稿停止
            sanction.setSanctionType(CodeConstants.SANCTION_TEMPORARY_SUSPENSION);
            sanction.setSuspendedUntil(LocalDateTime.now().plusDays(TEMPORARY_SUSPENSION_DAYS));
            accountSanctionRepository.save(sanction);
            if (email != null) {
                notificationService.sendTemporarySuspensionNotification(
                        email, username, reason, sanction.getSuspendedUntil().toLocalDate());
            }
            logger.info("一時停止を適用: userId={}, until={}", userId, sanction.getSuspendedUntil());
        } else {
            // 1回目: 警告
            sanction.setSanctionType(CodeConstants.SANCTION_WARNING);
            accountSanctionRepository.save(sanction);
            if (email != null) {
                notificationService.sendWarningNotification(email, username, reason);
            }
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
            user.setRole(CodeConstants.ROLE_SUSPENDED);
            userRepository.save(user);
        }

        // 公開中・審査待ちの写真を全てREMOVEDにする（既にREMOVED/QUARANTINEDのものは除く）
        Collection<Integer> activeStatuses = Arrays.asList(
                CodeConstants.MODERATION_STATUS_PUBLISHED, CodeConstants.MODERATION_STATUS_PENDING_REVIEW
        );
        var photosPage = photoRepository.findByUserIdAndModerationStatusInOrderByCreatedAtDesc(
                userId, activeStatuses, PageRequest.of(0, Integer.MAX_VALUE)
        );
        for (Photo photo : photosPage.getContent()) {
            photo.setModerationStatus(CodeConstants.MODERATION_STATUS_REMOVED);
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

    /**
     * 写真のviolationTypeを通報理由またはAI検出ラベルから決定する
     *
     * @param photoId 写真ID
     * @return violationType（通報理由 → AI検出ラベル → REASON_OTHERの優先順）
     */
    private int determineViolationType(Long photoId) {
        // 1. ユーザー通報がある場合、最多の通報理由カテゴリを使用
        List<Report> reports = reportRepository.findByTargetTypeAndTargetId(
                CodeConstants.TARGET_TYPE_PHOTO, photoId);
        if (!reports.isEmpty()) {
            return reports.stream()
                    .collect(Collectors.groupingBy(Report::getReasonCategory, Collectors.counting()))
                    .entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse(CodeConstants.REASON_OTHER);
        }

        // 2. AI検出ラベルからマッピング
        ModerationDetail detail = moderationDetailRepository
                .findByTargetTypeAndTargetId(CodeConstants.TARGET_TYPE_PHOTO, photoId)
                .orElse(null);
        if (detail != null && detail.getDetectedLabels() != null) {
            return mapLabelsToViolationType(detail.getDetectedLabels());
        }

        // 3. どちらもない場合
        return CodeConstants.REASON_OTHER;
    }

    /**
     * AI検出ラベル文字列からviolationTypeにマッピングする
     */
    private int mapLabelsToViolationType(String detectedLabels) {
        String[] labels = detectedLabels.split(",");
        for (String label : labels) {
            String trimmed = label.trim();
            if (ADULT_CONTENT_LABELS.contains(trimmed)) {
                return CodeConstants.REASON_ADULT_CONTENT;
            }
            if (VIOLENCE_LABELS.contains(trimmed)) {
                return CodeConstants.REASON_VIOLENCE;
            }
        }
        return CodeConstants.REASON_OTHER;
    }

}
