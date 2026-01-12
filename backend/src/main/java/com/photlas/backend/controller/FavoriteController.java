package com.photlas.backend.controller;

import com.photlas.backend.service.FavoriteService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class FavoriteController {

    private final FavoriteService favoriteService;

    public FavoriteController(FavoriteService favoriteService) {
        this.favoriteService = favoriteService;
    }

    /**
     * お気に入りに登録する
     */
    @PostMapping("/photos/{photoId}/favorite")
    public ResponseEntity<Void> addFavorite(
            @PathVariable Long photoId,
            Authentication authentication
    ) {
        String email = authentication.getName();
        favoriteService.addFavorite(photoId, email);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    /**
     * お気に入りを解除する
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
