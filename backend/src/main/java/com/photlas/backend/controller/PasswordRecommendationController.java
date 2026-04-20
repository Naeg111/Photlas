package com.photlas.backend.controller;

import com.photlas.backend.dto.PasswordRecommendationResponse;
import com.photlas.backend.service.PasswordRecommendationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Issue#81 Phase 4f - パスワード推奨バナー API（Round 12 / Q8）。
 *
 * <ul>
 *   <li>{@code GET /api/v1/users/me/password-recommendation}
 *       → バナー表示要否と推奨プロバイダ名を返す</li>
 *   <li>{@code POST /api/v1/users/me/password-recommendation/dismiss}
 *       → バナーを 7 日間非表示化</li>
 * </ul>
 *
 * <p>認証必須。レート制限は RateLimitFilter 経由（Issue#95 / Phase 4h で適用）。
 */
@RestController
@RequestMapping("/api/v1/users/me/password-recommendation")
public class PasswordRecommendationController {

    private final PasswordRecommendationService service;

    public PasswordRecommendationController(PasswordRecommendationService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<PasswordRecommendationResponse> getRecommendation(Authentication authentication) {
        String email = authentication.getName();
        return ResponseEntity.ok(service.evaluate(email));
    }

    @PostMapping("/dismiss")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> dismiss(Authentication authentication) {
        String email = authentication.getName();
        service.dismiss(email);
        return ResponseEntity.noContent().build();
    }
}
