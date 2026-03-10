package com.photlas.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Issue#54: 管理者モデレーションコントローラー
 * 管理者権限を持つユーザーのみアクセス可能
 */
@RestController
@RequestMapping("/api/v1/admin/moderation")
@PreAuthorize("hasRole('ADMIN')")
public class AdminModerationController {

    /**
     * 隔離キューを取得する
     *
     * @return 隔離中の画像一覧
     */
    @GetMapping("/queue")
    public ResponseEntity<Map<String, Object>> getModerationQueue() {
        // TODO: Issue#54 管理者ダッシュボード実装時に詳細を追加
        Map<String, Object> response = Map.of(
                "content", Collections.emptyList(),
                "total_elements", 0
        );
        return ResponseEntity.ok(response);
    }
}
