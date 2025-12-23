package com.photlas.backend.controller;

import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.ErrorResponse;
import com.photlas.backend.dto.PhotoDetailResponse;
import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.exception.CategoryNotFoundException;
import com.photlas.backend.service.PhotoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/photos")
public class PhotoController {

    private final PhotoService photoService;

    public PhotoController(PhotoService photoService) {
        this.photoService = photoService;
    }

    /**
     * 写真を投稿する
     *
     * @param request リクエストボディ
     * @param authentication 認証情報
     * @return 作成された写真の詳細情報
     */
    @PostMapping
    public ResponseEntity<PhotoResponse> createPhoto(
            @Valid @RequestBody CreatePhotoRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();
        PhotoResponse response = photoService.createPhoto(request, email);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * Issue#14: 写真詳細情報を取得
     *
     * @param photoId 写真ID
     * @return 写真詳細情報
     */
    @GetMapping("/{photoId}")
    public ResponseEntity<PhotoDetailResponse> getPhotoDetail(@PathVariable Long photoId) {
        PhotoDetailResponse response = photoService.getPhotoDetail(photoId);
        return ResponseEntity.ok(response);
    }

    /**
     * CategoryNotFoundExceptionをハンドリング
     */
    @ExceptionHandler(CategoryNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleCategoryNotFoundException(CategoryNotFoundException e) {
        ErrorResponse errorResponse = new ErrorResponse(e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }
}
