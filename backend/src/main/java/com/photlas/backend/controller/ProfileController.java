package com.photlas.backend.controller;

import com.photlas.backend.dto.OAuthConnectionResponse;
import com.photlas.backend.dto.UpdateProfileRequest;
import com.photlas.backend.dto.UpdateProfileImageRequest;
import com.photlas.backend.dto.UpdateProfileImageResponse;
import com.photlas.backend.dto.UpdateSnsLinksRequest;
import com.photlas.backend.dto.UpdateSnsLinksResponse;
import com.photlas.backend.dto.UpdateUsernameRequest;
import com.photlas.backend.dto.UpdateUsernameResponse;
import com.photlas.backend.dto.UploadUrlRequest;
import com.photlas.backend.dto.UploadUrlResponse;
import com.photlas.backend.dto.UserProfileResponse;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.entity.UserSnsLink;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.PhotoService;
import com.photlas.backend.service.ProfileService;
import com.photlas.backend.service.S3Service;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * プロフィール関連のエンドポイントを提供するコントローラー
 * 例外処理はGlobalExceptionHandlerに委譲する。
 */
@RestController
@RequestMapping("/api/v1/users")
public class ProfileController {

    private static final String ERROR_USER_NOT_FOUND = "ユーザーが見つかりません";
    private static final List<String> ALLOWED_IMAGE_EXTENSIONS = List.of("jpg", "jpeg", "png", "webp");

    private final ProfileService profileService;
    private final PhotoService photoService;
    private final S3Service s3Service;
    private final UserRepository userRepository;
    private final UserOAuthConnectionRepository userOAuthConnectionRepository;

    public ProfileController(
            ProfileService profileService,
            PhotoService photoService,
            S3Service s3Service,
            UserRepository userRepository,
            UserOAuthConnectionRepository userOAuthConnectionRepository) {
        this.profileService = profileService;
        this.photoService = photoService;
        this.s3Service = s3Service;
        this.userRepository = userRepository;
        this.userOAuthConnectionRepository = userOAuthConnectionRepository;
    }

    /**
     * 自分のユーザー情報を取得
     * GET /api/v1/users/me
     */
    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getMyProfile(Authentication authentication) {
        String email = authentication.getName();
        UserProfileResponse response = profileService.getMyProfile(email);
        return ResponseEntity.ok(response);
    }

    /**
     * 他ユーザーのプロフィール情報を取得
     * GET /api/v1/users/{userId}
     */
    @GetMapping("/{userId}")
    public ResponseEntity<UserProfileResponse> getUserProfile(@PathVariable Long userId) {
        UserProfileResponse response = profileService.getUserProfile(userId);
        return ResponseEntity.ok(response);
    }

    /**
     * プロフィール情報を更新
     * PUT /api/v1/users/me/profile
     */
    @PutMapping("/me/profile")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        UserProfileResponse response = profileService.updateProfile(email, request);
        return ResponseEntity.ok(response);
    }

    /**
     * プロフィール画像アップロード用の署名付きURL発行
     * POST /api/v1/users/me/profile-image/presigned-url
     */
    @PostMapping("/me/profile-image/presigned-url")
    public ResponseEntity<UploadUrlResponse> getProfileImagePresignedUrl(
            @Valid @RequestBody UploadUrlRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        if (!ALLOWED_IMAGE_EXTENSIONS.contains(request.getExtension().toLowerCase())) {
            throw new IllegalArgumentException("対応していないファイル形式です");
        }

        S3Service.UploadUrlResult result = s3Service.generatePresignedUploadUrl(
                "profile-images", user.getId(), request.getExtension(), request.getContentType());

        return ResponseEntity.ok(new UploadUrlResponse(result.getUploadUrl(), result.getObjectKey()));
    }

    /**
     * プロフィール画像キー登録
     * PUT /api/v1/users/me/profile-image
     */
    @PutMapping("/me/profile-image")
    public ResponseEntity<UpdateProfileImageResponse> updateProfileImage(
            @Valid @RequestBody UpdateProfileImageRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        String profileImageUrl = profileService.updateProfileImage(email, request.getObjectKey());
        return ResponseEntity.ok(new UpdateProfileImageResponse(profileImageUrl));
    }

    /**
     * プロフィール画像削除
     * DELETE /api/v1/users/me/profile-image
     */
    @DeleteMapping("/me/profile-image")
    public ResponseEntity<Void> deleteProfileImage(Authentication authentication) {
        String email = authentication.getName();
        profileService.deleteProfileImage(email);
        return ResponseEntity.noContent().build();
    }

    /**
     * SNSリンク保存
     * PUT /api/v1/users/me/sns-links
     */
    @PutMapping("/me/sns-links")
    public ResponseEntity<UpdateSnsLinksResponse> updateSnsLinks(
            @Valid @RequestBody UpdateSnsLinksRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        List<UserSnsLink> updatedLinks = profileService.updateSnsLinks(email, request.getSnsLinks());

        List<UpdateSnsLinksResponse.SnsLinkResponse> responseLinkList = updatedLinks.stream()
                .map(link -> new UpdateSnsLinksResponse.SnsLinkResponse(link.getPlatform(), link.getUrl()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(new UpdateSnsLinksResponse(responseLinkList));
    }

    /**
     * 表示名変更
     * PUT /api/v1/users/me/username
     */
    @PutMapping("/me/username")
    public ResponseEntity<UpdateUsernameResponse> updateUsername(
            @Valid @RequestBody UpdateUsernameRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        String username = profileService.updateUsername(email, request.getUsername());
        return ResponseEntity.ok(new UpdateUsernameResponse(username));
    }

    /**
     * Issue#81 Phase 4h: OAuth 連携一覧取得
     * GET /api/v1/users/me/oauth-connections
     *
     * <p>ログイン中ユーザーの OAuth 連携情報を返す（認証必須）。
     * email / providerUserId 等 PII はレスポンスに含めず、プロバイダ名と作成日時のみ。
     */
    @GetMapping("/me/oauth-connections")
    public ResponseEntity<OAuthConnectionResponse> getOAuthConnections(Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        List<UserOAuthConnection> connections = userOAuthConnectionRepository.findByUserId(user.getId());
        List<OAuthConnectionResponse.Connection> items = connections.stream()
                .map(c -> OAuthConnectionResponse.Connection.of(
                        OAuthProvider.fromCode(c.getProviderCode()),
                        c.getCreatedAt()))
                .collect(Collectors.toList());

        return ResponseEntity.ok(new OAuthConnectionResponse(items));
    }

    /**
     * 自分の投稿写真一覧を取得
     * GET /api/v1/users/me/photos
     */
    @GetMapping("/me/photos")
    public ResponseEntity<Map<String, Object>> getMyPhotos(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        Pageable pageable = PageRequest.of(page, size);
        Map<String, Object> response = photoService.getUserPhotos(user.getId(), pageable, email);
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
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        Map<String, Object> response = photoService.getUserPhotos(userId, pageable, null);
        return ResponseEntity.ok(response);
    }
}
