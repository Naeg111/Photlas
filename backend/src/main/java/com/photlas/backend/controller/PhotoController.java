package com.photlas.backend.controller;

import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.ErrorResponse;
import com.photlas.backend.dto.PhotoDetailResponse;
import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.dto.UpdatePhotoRequest;
import com.photlas.backend.dto.UploadUrlRequest;
import com.photlas.backend.dto.UploadUrlResponse;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.CategoryNotFoundException;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.PhotoService;
import com.photlas.backend.service.S3Service;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/photos")
public class PhotoController {

    private static final List<String> ALLOWED_IMAGE_EXTENSIONS = List.of("jpg", "jpeg", "png", "webp", "heic");

    private final PhotoService photoService;
    private final S3Service s3Service;
    private final UserRepository userRepository;

    public PhotoController(PhotoService photoService, S3Service s3Service, UserRepository userRepository) {
        this.photoService = photoService;
        this.s3Service = s3Service;
        this.userRepository = userRepository;
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
     * 写真詳細を取得する
     *
     * @param photoId 写真ID
     * @param authentication 認証情報（未認証の場合はnull）
     * @return 写真の詳細情報
     */
    @GetMapping("/{photoId:\\d+}")
    public ResponseEntity<PhotoDetailResponse> getPhotoDetail(
            @PathVariable Long photoId,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        PhotoDetailResponse response = photoService.getPhotoDetail(photoId, email);
        return ResponseEntity.ok(response);
    }

    /**
     * 写真アップロード用の署名付きURLを取得する
     * Issue#9: 写真アップロード処理
     *
     * @param request リクエストボディ（extension, contentType）
     * @param authentication 認証情報
     * @return 署名付きURLとオブジェクトキー
     */
    @PostMapping("/upload-url")
    public ResponseEntity<UploadUrlResponse> getUploadUrl(
            @Valid @RequestBody UploadUrlRequest request,
            Authentication authentication
    ) {
        // 拡張子のバリデーション
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(request.getExtension().toLowerCase())) {
            throw new IllegalArgumentException("対応していないファイル形式です");
        }

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません"));

        S3Service.UploadUrlResult result = s3Service.generatePresignedUploadUrl(
                "uploads",
                user.getId(),
                request.getExtension(),
                request.getContentType()
        );

        UploadUrlResponse response = new UploadUrlResponse(result.getUploadUrl(), result.getObjectKey());
        return ResponseEntity.ok(response);
    }

    /**
     * Issue#54: 写真のモデレーションステータスを取得する（ポーリング用）
     *
     * @param photoId 写真ID
     * @param authentication 認証情報
     * @return モデレーションステータス
     */
    @GetMapping("/{photoId:\\d+}/status")
    public ResponseEntity<java.util.Map<String, Object>> getPhotoStatus(
            @PathVariable Long photoId,
            Authentication authentication
    ) {
        if (authentication == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません"));

        com.photlas.backend.entity.Photo photo = photoService.getPhotoForOwner(photoId, user.getId());
        return ResponseEntity.ok(java.util.Map.of(
                "photo_id", photo.getPhotoId().toString(),
                "moderation_status", photo.getModerationStatus()
        ));
    }

    /**
     * Issue#61: 写真メタデータを更新する
     *
     * @param photoId 写真ID
     * @param request 更新リクエスト
     * @param authentication 認証情報
     * @return 更新後の写真詳細情報
     */
    @PutMapping("/{photoId:\\d+}")
    public ResponseEntity<PhotoDetailResponse> updatePhoto(
            @PathVariable Long photoId,
            @Valid @RequestBody UpdatePhotoRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();
        PhotoDetailResponse response = photoService.updatePhoto(photoId, request, email);
        return ResponseEntity.ok(response);
    }

    /**
     * Issue#57: ユーザーが自分の写真を削除する
     *
     * @param photoId 写真ID
     * @param authentication 認証情報
     * @return 204 No Content
     */
    @DeleteMapping("/{photoId:\\d+}")
    public ResponseEntity<Void> deletePhoto(
            @PathVariable Long photoId,
            Authentication authentication
    ) {
        String email = authentication.getName();
        photoService.deletePhoto(photoId, email);
        return ResponseEntity.noContent().build();
    }

    /**
     * CategoryNotFoundExceptionをハンドリング
     */
    @ExceptionHandler(CategoryNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleCategoryNotFoundException(CategoryNotFoundException e) {
        ErrorResponse errorResponse = new ErrorResponse(e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

    /**
     * IllegalArgumentExceptionをハンドリング
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgumentException(IllegalArgumentException e) {
        ErrorResponse errorResponse = new ErrorResponse(e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }
}
