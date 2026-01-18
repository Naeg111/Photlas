package com.photlas.backend.controller;

import com.photlas.backend.dto.ErrorResponse;
import com.photlas.backend.dto.UpdateProfileRequest;
import com.photlas.backend.dto.UploadUrlRequest;
import com.photlas.backend.dto.UploadUrlResponse;
import com.photlas.backend.dto.UserProfileResponse;
import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.dto.UpdateEmailRequest;
import com.photlas.backend.dto.UpdateEmailResponse;
import com.photlas.backend.dto.UpdatePasswordRequest;
import com.photlas.backend.dto.DeleteAccountRequest;
import com.photlas.backend.dto.UpdateProfileImageRequest;
import com.photlas.backend.dto.UpdateProfileImageResponse;
import com.photlas.backend.dto.UpdateSnsLinksRequest;
import com.photlas.backend.dto.UpdateSnsLinksResponse;
import com.photlas.backend.dto.UpdateUsernameRequest;
import com.photlas.backend.dto.UpdateUsernameResponse;
import com.photlas.backend.entity.UserSnsLink;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.PhotoService;
import com.photlas.backend.service.S3Service;
import com.photlas.backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;
    private final S3Service s3Service;
    private final UserRepository userRepository;
    private final PhotoService photoService;

    public UserController(UserService userService, S3Service s3Service, UserRepository userRepository, PhotoService photoService) {
        this.userService = userService;
        this.s3Service = s3Service;
        this.userRepository = userRepository;
        this.photoService = photoService;
    }

    /**
     * 自分のユーザー情報を取得
     * GET /api/v1/users/me
     */
    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getMyProfile(Authentication authentication) {
        String email = authentication.getName();
        UserProfileResponse response = userService.getMyProfile(email);
        return ResponseEntity.ok(response);
    }

    /**
     * 他ユーザーのプロフィール情報を取得
     * GET /api/v1/users/{userId}
     */
    @GetMapping("/{userId}")
    public ResponseEntity<UserProfileResponse> getUserProfile(@PathVariable Long userId) {
        UserProfileResponse response = userService.getUserProfile(userId);
        return ResponseEntity.ok(response);
    }

    /**
     * プロフィール情報を更新
     * PUT /api/v1/users/me/profile
     */
    @PutMapping("/me/profile")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();
        UserProfileResponse response = userService.updateProfile(email, request);
        return ResponseEntity.ok(response);
    }

    /**
     * プロフィール画像アップロード用の署名付きURL発行
     * POST /api/v1/users/me/avatar-upload-url
     */
    @PostMapping("/me/avatar-upload-url")
    public ResponseEntity<UploadUrlResponse> getAvatarUploadUrl(
            @Valid @RequestBody UploadUrlRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

        S3Service.UploadUrlResult result = s3Service.generatePresignedUploadUrl(
                "avatars",
                user.getId(),
                request.getExtension(),
                request.getContentType()
        );

        UploadUrlResponse response = new UploadUrlResponse(
                result.getUploadUrl(),
                result.getObjectKey()
        );

        return ResponseEntity.ok(response);
    }

    /**
     * ユーザーの投稿写真一覧を取得
     * GET /api/v1/users/{userId}/photos
     */
    @GetMapping("/{userId}/photos")
    public ResponseEntity<Map<String, Object>> getUserPhotos(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        // ページネーション設定（投稿日時の新しい順）
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));

        // TODO: PhotoServiceにgetUserPhotosメソッドを追加する
        // 現在はダミーレスポンスを返す
        Map<String, Object> response = new HashMap<>();
        response.put("content", List.of());
        response.put("page", page);
        response.put("size", size);
        response.put("totalElements", 0);
        response.put("totalPages", 0);

        return ResponseEntity.ok(response);
    }

    /**
     * メールアドレス変更（Issue#20）
     * PUT /api/v1/users/me/email
     */
    @PutMapping("/me/email")
    public ResponseEntity<UpdateEmailResponse> updateEmail(
            @Valid @RequestBody UpdateEmailRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();
        String updatedEmail = userService.updateEmail(email, request.getNewEmail(), request.getCurrentPassword());
        UpdateEmailResponse response = new UpdateEmailResponse(updatedEmail);
        return ResponseEntity.ok(response);
    }

    /**
     * パスワード変更（Issue#20）
     * PUT /api/v1/users/me/password
     */
    @PutMapping("/me/password")
    public ResponseEntity<Void> updatePassword(
            @Valid @RequestBody UpdatePasswordRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();
        userService.updatePassword(
                email,
                request.getCurrentPassword(),
                request.getNewPassword(),
                request.getNewPasswordConfirm()
        );
        return ResponseEntity.ok().build();
    }

    /**
     * アカウント削除（Issue#20）
     * DELETE /api/v1/users/me
     */
    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteAccount(
            @Valid @RequestBody DeleteAccountRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();
        userService.deleteAccount(email, request.getPassword());
        return ResponseEntity.noContent().build();
    }

    // ============================================================
    // Issue#29: プロフィール機能強化
    // ============================================================

    private static final List<String> ALLOWED_IMAGE_EXTENSIONS = List.of("jpg", "jpeg", "png", "webp");
    private static final List<String> ALLOWED_PLATFORMS = List.of("twitter", "instagram", "youtube", "tiktok");

    /**
     * プロフィール画像アップロード用の署名付きURL発行（Issue#29）
     * POST /api/v1/users/me/profile-image/presigned-url
     */
    @PostMapping("/me/profile-image/presigned-url")
    public ResponseEntity<UploadUrlResponse> getProfileImagePresignedUrl(
            @Valid @RequestBody UploadUrlRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

        // 拡張子のバリデーション
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(request.getExtension().toLowerCase())) {
            throw new IllegalArgumentException("対応していないファイル形式です");
        }

        S3Service.UploadUrlResult result = s3Service.generatePresignedUploadUrl(
                "profile-images",
                user.getId(),
                request.getExtension(),
                request.getContentType()
        );

        UploadUrlResponse response = new UploadUrlResponse(
                result.getUploadUrl(),
                result.getObjectKey()
        );

        return ResponseEntity.ok(response);
    }

    /**
     * プロフィール画像キー登録（Issue#29）
     * PUT /api/v1/users/me/profile-image
     */
    @PutMapping("/me/profile-image")
    public ResponseEntity<UpdateProfileImageResponse> updateProfileImage(
            @Valid @RequestBody UpdateProfileImageRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();
        String profileImageUrl = userService.updateProfileImage(email, request.getObjectKey());
        UpdateProfileImageResponse response = new UpdateProfileImageResponse(profileImageUrl);
        return ResponseEntity.ok(response);
    }

    /**
     * プロフィール画像削除（Issue#29）
     * DELETE /api/v1/users/me/profile-image
     */
    @DeleteMapping("/me/profile-image")
    public ResponseEntity<Void> deleteProfileImage(Authentication authentication) {
        String email = authentication.getName();
        userService.deleteProfileImage(email);
        return ResponseEntity.noContent().build();
    }

    /**
     * SNSリンク保存（Issue#29）
     * PUT /api/v1/users/me/sns-links
     */
    @PutMapping("/me/sns-links")
    public ResponseEntity<UpdateSnsLinksResponse> updateSnsLinks(
            @Valid @RequestBody UpdateSnsLinksRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();

        // バリデーション
        if (request.getSnsLinks() != null) {
            java.util.Set<String> platforms = new java.util.HashSet<>();
            for (UpdateSnsLinksRequest.SnsLinkRequest snsLink : request.getSnsLinks()) {
                // プラットフォームのバリデーション
                if (!ALLOWED_PLATFORMS.contains(snsLink.getPlatform())) {
                    throw new IllegalArgumentException("未対応のプラットフォームです: " + snsLink.getPlatform());
                }
                // プラットフォーム重複チェック
                if (!platforms.add(snsLink.getPlatform())) {
                    throw new IllegalArgumentException("同じプラットフォームが重複しています: " + snsLink.getPlatform());
                }
                // URLとプラットフォームの整合性チェック
                if (!isValidUrlForPlatform(snsLink.getPlatform(), snsLink.getUrl())) {
                    throw new IllegalArgumentException("URLがプラットフォームと一致しません");
                }
            }
        }

        List<UserSnsLink> updatedLinks = userService.updateSnsLinks(email, request.getSnsLinks());

        List<UpdateSnsLinksResponse.SnsLinkResponse> responseLinkList = updatedLinks.stream()
                .map(link -> new UpdateSnsLinksResponse.SnsLinkResponse(link.getPlatform(), link.getUrl()))
                .collect(java.util.stream.Collectors.toList());

        UpdateSnsLinksResponse response = new UpdateSnsLinksResponse(responseLinkList);
        return ResponseEntity.ok(response);
    }

    /**
     * URLとプラットフォームの整合性チェック
     */
    private boolean isValidUrlForPlatform(String platform, String url) {
        return switch (platform) {
            case "twitter" -> url.contains("x.com") || url.contains("twitter.com");
            case "instagram" -> url.contains("instagram.com");
            case "youtube" -> url.contains("youtube.com");
            case "tiktok" -> url.contains("tiktok.com");
            default -> false;
        };
    }

    /**
     * ユーザー名変更（Issue#29）
     * PUT /api/v1/users/me/username
     */
    @PutMapping("/me/username")
    public ResponseEntity<UpdateUsernameResponse> updateUsername(
            @Valid @RequestBody UpdateUsernameRequest request,
            Authentication authentication
    ) {
        String email = authentication.getName();
        String username = userService.updateUsername(email, request.getUsername());
        UpdateUsernameResponse response = new UpdateUsernameResponse(username);
        return ResponseEntity.ok(response);
    }

    /**
     * ユーザーが見つからない場合の例外ハンドリング
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntimeException(RuntimeException e) {
        if (e.getMessage().contains("ユーザーが見つかりません")) {
            ErrorResponse errorResponse = new ErrorResponse(e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errorResponse);
        }
        ErrorResponse errorResponse = new ErrorResponse(e.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
    }

    /**
     * ユーザー名重複エラーのハンドリング
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgumentException(IllegalArgumentException e) {
        if (e.getMessage().contains("このユーザー名はすでに使用されています")) {
            ErrorResponse errorResponse = new ErrorResponse(e.getMessage());
            return ResponseEntity.status(HttpStatus.CONFLICT).body(errorResponse);
        }
        ErrorResponse errorResponse = new ErrorResponse(e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

    /**
     * Issue#20: 認証エラー（401 Unauthorized）をハンドリング
     */
    @ExceptionHandler(com.photlas.backend.exception.UnauthorizedException.class)
    public ResponseEntity<ErrorResponse> handleUnauthorizedException(com.photlas.backend.exception.UnauthorizedException e) {
        ErrorResponse errorResponse = new ErrorResponse(e.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
    }

    /**
     * Issue#20: 競合エラー（409 Conflict）をハンドリング
     */
    @ExceptionHandler(com.photlas.backend.exception.ConflictException.class)
    public ResponseEntity<ErrorResponse> handleConflictException(com.photlas.backend.exception.ConflictException e) {
        ErrorResponse errorResponse = new ErrorResponse(e.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(errorResponse);
    }
}
