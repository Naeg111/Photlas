package com.photlas.backend.controller;

import com.photlas.backend.service.FavoriteService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * お気に入り機能を提供するコントローラー
 */
@RestController
@RequestMapping("/api/v1")
public class FavoriteController {

    private final FavoriteService favoriteService;

    public FavoriteController(FavoriteService favoriteService) {
        this.favoriteService = favoriteService;
    }

    /**
     * お気に入りに登録する（Issue#30）
     *
     * @param photoId 写真ID
     * @param authentication 認証情報
     * @return 201 Created（成功時）, 409 Conflict（既に登録済み）
     */
    @PostMapping("/photos/{photoId}/favorite")
    public ResponseEntity<Void> addFavorite(
            @PathVariable Long photoId,
            Authentication authentication
    ) {
        String email = authentication.getName();
        favoriteService.addFavorite(photoId, email);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    /**
     * お気に入りを解除する（Issue#30）
     *
     * @param photoId 写真ID
     * @param authentication 認証情報
     * @return 204 No Content（成功時）, 404 Not Found（登録されていない）
     */
    @DeleteMapping("/photos/{photoId}/favorite")
    public ResponseEntity<Void> removeFavorite(
            @PathVariable Long photoId,
            Authentication authentication
    ) {
        String email = authentication.getName();
        favoriteService.removeFavorite(photoId, email);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    /**
     * お気に入り一覧を取得する
     *
     * @param page ページ番号（デフォルト: 0）
     * @param size ページサイズ（デフォルト: 20）
     * @param authentication 認証情報
     * @return お気に入り一覧のページネーションレスポンス
     */
    @GetMapping("/users/me/favorites")
    public ResponseEntity<Map<String, Object>> getFavorites(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication
    ) {
        String email = authentication.getName();
        Map<String, Object> response = favoriteService.getFavorites(email, page, size);
        return ResponseEntity.ok(response);
    }
}
