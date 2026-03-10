package com.photlas.backend.controller;

import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.service.AdminModerationService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

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

    public AdminModerationController(
            AdminModerationService adminModerationService,
            PhotoRepository photoRepository
    ) {
        this.adminModerationService = adminModerationService;
        this.photoRepository = photoRepository;
    }

    /**
     * 隔離キューを取得する
     *
     * @param pageable ページネーション情報
     * @return 隔離中の写真一覧
     */
    @GetMapping("/queue")
    public ResponseEntity<Map<String, Object>> getModerationQueue(Pageable pageable) {
        Page<Photo> quarantinedPhotos = photoRepository.findByModerationStatusOrderByUpdatedAtDesc(
                ModerationStatus.QUARANTINED, pageable);

        Map<String, Object> response = new HashMap<>();
        response.put("content", quarantinedPhotos.getContent());
        response.put("total_elements", quarantinedPhotos.getTotalElements());
        response.put("total_pages", quarantinedPhotos.getTotalPages());
        return ResponseEntity.ok(response);
    }

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
