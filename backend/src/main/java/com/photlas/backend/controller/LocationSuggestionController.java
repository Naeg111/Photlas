package com.photlas.backend.controller;

import com.photlas.backend.dto.LocationSuggestionRequest;
import com.photlas.backend.dto.LocationSuggestionReviewResponse;
import com.photlas.backend.entity.LocationSuggestion;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.service.LocationSuggestionService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Issue#65: 位置情報修正の指摘コントローラー
 */
@RestController
@RequestMapping("/api/v1")
public class LocationSuggestionController {

    private final LocationSuggestionService locationSuggestionService;
    private final PhotoRepository photoRepository;
    private final SpotRepository spotRepository;

    public LocationSuggestionController(
            LocationSuggestionService locationSuggestionService,
            PhotoRepository photoRepository,
            SpotRepository spotRepository) {
        this.locationSuggestionService = locationSuggestionService;
        this.photoRepository = photoRepository;
        this.spotRepository = spotRepository;
    }

    /**
     * 位置情報の指摘を作成する
     */
    @PostMapping("/photos/{photoId}/location-suggestions")
    public ResponseEntity<?> createSuggestion(
            @PathVariable Long photoId,
            @RequestBody LocationSuggestionRequest request,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            LocationSuggestion suggestion = locationSuggestionService.createSuggestion(
                    photoId, email, request.getLatitude(), request.getLongitude());
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Map.of("id", suggestion.getId()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * 現在のユーザーが指定の写真に対して指摘済みかどうかを返す
     */
    @GetMapping("/photos/{photoId}/location-suggestions/status")
    public ResponseEntity<?> getStatus(
            @PathVariable Long photoId,
            Authentication authentication) {
        String email = authentication.getName();
        boolean hasSuggested = locationSuggestionService.hasSuggested(photoId, email);
        return ResponseEntity.ok(Map.of("hasSuggested", hasSuggested));
    }

    /**
     * レビュー情報を取得する
     */
    @GetMapping("/location-suggestions/review")
    public ResponseEntity<?> getReviewInfo(
            @RequestParam String token,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            LocationSuggestion suggestion = locationSuggestionService.getReviewInfo(token, email);

            Photo photo = photoRepository.findById(suggestion.getPhotoId()).orElse(null);
            Spot spot = (photo != null) ? spotRepository.findById(photo.getSpotId()).orElse(null) : null;

            LocationSuggestionReviewResponse response = new LocationSuggestionReviewResponse();
            response.setSuggestionId(suggestion.getId());
            response.setSuggestedLatitude(suggestion.getSuggestedLatitude());
            response.setSuggestedLongitude(suggestion.getSuggestedLongitude());
            if (spot != null) {
                response.setCurrentLatitude(spot.getLatitude());
                response.setCurrentLongitude(spot.getLongitude());
            }
            if (photo != null) {
                response.setPhotoTitle(photo.getTitle());
            }

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * 指摘を受け入れる
     */
    @PostMapping("/location-suggestions/review/accept")
    public ResponseEntity<?> acceptSuggestion(
            @RequestParam String token,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            locationSuggestionService.acceptSuggestion(token, email);
            return ResponseEntity.ok(Map.of("message", "撮影場所の指摘を受け入れました"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", e.getMessage()));
        }
    }

    /**
     * 指摘を拒否する
     */
    @PostMapping("/location-suggestions/review/reject")
    public ResponseEntity<?> rejectSuggestion(
            @RequestParam String token,
            Authentication authentication) {
        try {
            String email = authentication.getName();
            locationSuggestionService.rejectSuggestion(token, email);
            return ResponseEntity.ok(Map.of("message", "撮影場所の指摘を拒否しました"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", e.getMessage()));
        }
    }
}
