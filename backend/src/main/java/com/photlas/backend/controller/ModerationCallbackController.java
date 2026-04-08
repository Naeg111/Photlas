package com.photlas.backend.controller;

import com.photlas.backend.dto.ErrorResponse;
import com.photlas.backend.entity.ModerationDetail;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.repository.ModerationDetailRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.ModerationNotificationService;
import com.photlas.backend.service.QuarantineService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Issue#54: Lambda→バックエンドのモデレーションコールバックコントローラー
 * APIキー認証で保護されたエンドポイント
 */
@RestController
@RequestMapping("/api/v1/internal/moderation")
public class ModerationCallbackController {

    private static final Logger logger = LoggerFactory.getLogger(ModerationCallbackController.class);
    private static final String API_KEY_HEADER = "X-API-Key";

    @Value("${moderation.api-key:test-moderation-api-key}")
    private String validApiKey;

    private static final String KEY_MESSAGE = "message";
    private static final String PROFILE_IMAGE_PREFIX = "profile-images/";

    private final PhotoRepository photoRepository;
    private final ModerationDetailRepository moderationDetailRepository;
    private final UserRepository userRepository;
    private final ModerationNotificationService notificationService;
    private final QuarantineService quarantineService;

    public ModerationCallbackController(
            PhotoRepository photoRepository,
            ModerationDetailRepository moderationDetailRepository,
            UserRepository userRepository,
            ModerationNotificationService notificationService,
            QuarantineService quarantineService
    ) {
        this.photoRepository = photoRepository;
        this.moderationDetailRepository = moderationDetailRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
        this.quarantineService = quarantineService;
    }

    /**
     * AIスキャン結果のコールバック
     * Lambda関数からスキャン結果を受け取り、写真のステータスを更新する
     *
     * @param apiKey APIキー
     * @param request スキャン結果（s3_object_key, status, confidence_score）
     * @return 処理結果
     */
    @PostMapping("/callback")
    public ResponseEntity<?> handleModerationCallback(
            @RequestHeader(API_KEY_HEADER) String apiKey,
            @RequestBody Map<String, Object> request
    ) {
        // APIキー検証
        if (!validApiKey.equals(apiKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("無効なAPIキーです"));
        }

        String s3ObjectKey = (String) request.get("s3_object_key");
        String statusStr = String.valueOf(request.get("status"));
        Double confidenceScore = request.get("confidence_score") != null
                ? ((Number) request.get("confidence_score")).doubleValue()
                : null;
        @SuppressWarnings("unchecked")
        java.util.List<String> detectedLabels = (java.util.List<String>) request.get("detected_labels");

        Integer newStatus = parseStatus(statusStr);

        // Issue#54: プロフィール画像の場合は別処理
        if (s3ObjectKey.startsWith(PROFILE_IMAGE_PREFIX)) {
            return handleProfileImageCallback(s3ObjectKey, newStatus, confidenceScore);
        }

        // S3オブジェクトキーから写真を検索
        Photo photo = photoRepository.findByS3ObjectKey(s3ObjectKey)
                .orElseThrow(() -> new PhotoNotFoundException("写真が見つかりません: " + s3ObjectKey));

        // ステータスを更新
        photo.setModerationStatus(newStatus);
        boolean isQuarantined = Integer.valueOf(CodeConstants.MODERATION_STATUS_QUARANTINED).equals(newStatus);

        // Issue#54: 隔離時にS3ファイルをquarantined/プレフィックスに移動
        if (isQuarantined) {
            quarantineService.quarantinePhoto(photo);
        } else {
            photoRepository.save(photo);
        }

        // モデレーション詳細を保存
        saveModerationDetail(CodeConstants.TARGET_TYPE_PHOTO, photo.getPhotoId(),
                confidenceScore, newStatus, detectedLabels);

        // Issue#54: 隔離時にユーザーへメール通知
        if (isQuarantined) {
            userRepository.findById(photo.getUserId()).ifPresent(user ->
                    notificationService.sendQuarantineNotification(
                            user.getEmail(), user.getUsername(), photo.getCreatedAt(), user.getLanguage()));
        }

        logger.info("モデレーションコールバック処理完了: s3Key={}, status={}, confidence={}",
                s3ObjectKey, newStatus, confidenceScore);

        return ResponseEntity.ok(Map.of(KEY_MESSAGE, "ステータスを更新しました"));
    }

    /**
     * Issue#54: プロフィール画像のモデレーションコールバック処理
     * QUARANTINEDの場合はプロフィール画像をリセット（デフォルトに戻す）
     */
    private ResponseEntity<?> handleProfileImageCallback(
            String s3ObjectKey, Integer status, Double confidenceScore) {

        User user = userRepository.findByProfileImageS3Key(s3ObjectKey).orElse(null);

        if (user == null) {
            logger.warn("プロフィール画像の所有者が見つかりません: s3Key={}", s3ObjectKey);
            return ResponseEntity.ok(Map.of(KEY_MESSAGE, "対象ユーザーが見つかりませんでした"));
        }

        if (Integer.valueOf(CodeConstants.MODERATION_STATUS_QUARANTINED).equals(status)) {
            // プロフィール画像をデフォルトにリセット
            user.setProfileImageS3Key(null);
            userRepository.save(user);
            logger.info("プロフィール画像をリセット: userId={}, s3Key={}", user.getId(), s3ObjectKey);
        }

        // モデレーション詳細を保存
        saveModerationDetail(CodeConstants.TARGET_TYPE_PROFILE, user.getId(),
                confidenceScore, status, null);

        logger.info("プロフィール画像モデレーション完了: userId={}, status={}, confidence={}",
                user.getId(), status, confidenceScore);

        return ResponseEntity.ok(Map.of(KEY_MESSAGE, "プロフィール画像のステータスを更新しました"));
    }

    /**
     * モデレーション詳細を保存する
     */
    private void saveModerationDetail(
            Integer targetType, Long targetId,
            Double confidenceScore, Integer status,
            java.util.List<String> detectedLabels) {

        ModerationDetail detail = new ModerationDetail();
        detail.setTargetType(targetType);
        detail.setTargetId(targetId);
        detail.setSource(CodeConstants.MODERATION_SOURCE_AI_SCAN);
        detail.setAiConfidenceScore(confidenceScore);
        if (detectedLabels != null && !detectedLabels.isEmpty()) {
            detail.setDetectedLabels(String.join(",", detectedLabels));
        }
        if (Integer.valueOf(CodeConstants.MODERATION_STATUS_QUARANTINED).equals(status)) {
            detail.setQuarantinedAt(LocalDateTime.now());
        }
        moderationDetailRepository.save(detail);
    }

    /**
     * PENDING_REVIEW滞留チェック
     * 監視用Lambda関数から呼び出され、指定時間以上PENDING_REVIEWのまま滞留している投稿数を返す
     *
     * @param apiKey APIキー
     * @param thresholdMinutes 滞留閾値（分）
     * @return 滞留件数
     */
    @GetMapping("/stale-check")
    public ResponseEntity<?> checkStalePendingReviews(
            @RequestHeader(API_KEY_HEADER) String apiKey,
            @RequestParam(value = "threshold_minutes", defaultValue = "5") int thresholdMinutes
    ) {
        if (!validApiKey.equals(apiKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("無効なAPIキーです"));
        }

        LocalDateTime threshold = LocalDateTime.now().minusMinutes(thresholdMinutes);
        long staleCount = photoRepository.countByModerationStatusAndCreatedAtBefore(
                CodeConstants.MODERATION_STATUS_PENDING_REVIEW, threshold
        );

        logger.info("PENDING_REVIEW滞留チェック: threshold={}分, staleCount={}", thresholdMinutes, staleCount);

        return ResponseEntity.ok(Map.of("stale_count", staleCount));
    }

    /**
     * ステータス文字列を数値コードに変換する
     * 数値文字列の場合はそのまま変換し、レガシー文字列の場合はCodeConstantsの値にマッピングする
     *
     * @param statusStr ステータス文字列（数値または列挙名）
     * @return 数値コード
     */
    private Integer parseStatus(String statusStr) {
        try {
            return Integer.parseInt(statusStr);
        } catch (NumberFormatException e) {
            // Legacy string compatibility
        }
        return switch (statusStr) {
            case "PENDING_REVIEW" -> CodeConstants.MODERATION_STATUS_PENDING_REVIEW;
            case "PUBLISHED" -> CodeConstants.MODERATION_STATUS_PUBLISHED;
            case "QUARANTINED" -> CodeConstants.MODERATION_STATUS_QUARANTINED;
            case "REMOVED" -> CodeConstants.MODERATION_STATUS_REMOVED;
            default -> throw new IllegalArgumentException("Unknown status: " + statusStr);
        };
    }
}
