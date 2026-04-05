package com.photlas.backend.controller;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Report;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.ReportRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.AdminModerationService;
import com.photlas.backend.service.S3Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Issue#54: 管理者モデレーションコントローラー
 * 管理者権限を持つユーザーのみアクセス可能
 */
@RestController
@RequestMapping("/api/v1/admin/moderation")
@PreAuthorize("hasRole('ADMIN')")
public class AdminModerationController {

    private final AdminModerationService adminModerationService;
    private final PhotoRepository photoRepository;
    private final UserRepository userRepository;
    private final ReportRepository reportRepository;
    private final S3Service s3Service;

    public AdminModerationController(
            AdminModerationService adminModerationService,
            PhotoRepository photoRepository,
            UserRepository userRepository,
            ReportRepository reportRepository,
            S3Service s3Service
    ) {
        this.adminModerationService = adminModerationService;
        this.photoRepository = photoRepository;
        this.userRepository = userRepository;
        this.reportRepository = reportRepository;
        this.s3Service = s3Service;
    }

    /**
     * 隔離キューを取得する
     *
     * @param pageable ページネーション情報
     * @return 隔離中の写真一覧（画像URL付き）
     */
    @GetMapping("/queue")
    public ResponseEntity<Map<String, Object>> getModerationQueue(Pageable pageable) {
        Page<Photo> quarantinedPhotos = photoRepository.findByModerationStatusOrderByUpdatedAtDesc(
                CodeConstants.MODERATION_STATUS_QUARANTINED, pageable);

        List<ModerationQueueItem> items = quarantinedPhotos.getContent().stream()
                .map(this::toQueueItem)
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("content", items);
        response.put("total_elements", quarantinedPhotos.getTotalElements());
        response.put("total_pages", quarantinedPhotos.getTotalPages());
        return ResponseEntity.ok(response);
    }

    /**
     * PhotoエンティティからModerationQueueItemに変換する
     */
    private ModerationQueueItem toQueueItem(Photo photo) {
        String imageUrl = s3Service.generateCdnUrl(photo.getS3ObjectKey());
        String username = userRepository.findById(photo.getUserId())
                .map(User::getUsername)
                .orElse("不明");
        String createdAt = photo.getCreatedAt() != null
                ? photo.getCreatedAt().format(DateTimeFormatter.ISO_DATE_TIME) : null;

        // Issue#54: 通報情報を取得
        List<Report> reports = reportRepository.findByTargetTypeAndTargetId(
                CodeConstants.TARGET_TYPE_PHOTO, photo.getPhotoId());
        int reportCount = reports.size();
        List<Integer> reportReasons = reports.stream()
                .map(r -> r.getReasonCategory())
                .distinct()
                .collect(Collectors.toList());

        return new ModerationQueueItem(
                photo.getPhotoId(), imageUrl,
                photo.getUserId(), username, createdAt,
                reportCount, reportReasons
        );
    }

    /**
     * モデレーションキューアイテムDTO
     */
    record ModerationQueueItem(
            @JsonProperty("photo_id") Long photoId,
            @JsonProperty("image_url") String imageUrl,
            @JsonProperty("user_id") Long userId,
            String username,
            @JsonProperty("created_at") String createdAt,
            @JsonProperty("report_count") int reportCount,
            @JsonProperty("report_reasons") List<Integer> reportReasons
    ) {}

    /**
     * 写真を承認する（問題なし判定）
     *
     * @param photoId 写真ID
     * @return 成功レスポンス
     */
    @PostMapping("/photos/{photoId}/approve")
    public ResponseEntity<Map<String, String>> approvePhoto(@PathVariable Long photoId) {
        adminModerationService.approvePhoto(photoId);
        return ResponseEntity.ok(Map.of("message", "写真を承認しました"));
    }

    /**
     * 写真を拒否する（違反あり判定）
     *
     * @param photoId 写真ID
     * @param request 拒否理由を含むリクエスト
     * @return 成功レスポンス
     */
    @PostMapping("/photos/{photoId}/reject")
    public ResponseEntity<Map<String, String>> rejectPhoto(
            @PathVariable Long photoId,
            @RequestBody Map<String, String> request
    ) {
        String reason = request.getOrDefault("reason", "利用規約違反");
        adminModerationService.rejectPhoto(photoId, reason);
        return ResponseEntity.ok(Map.of("message", "写真を拒否しました"));
    }
}
