package com.photlas.backend.service;

import com.photlas.backend.dto.PhotoOgpMeta;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Issue#58 §6: 写真個別の OGP メタ値を生成するサービス。
 *
 * <p>{@code /photo-viewer/{id}}（{@link com.photlas.backend.controller.PhotoViewerController}）が
 * index.html に差し込む OGP を組み立てる。公開・退会/停止チェックは {@code OgpController} と同じ基準。
 * 無効・非公開・退会オーナーの写真は {@link Optional#empty()} を返す（呼び出し側は汎用 OGP のまま）。</p>
 */
@Service
public class PhotoOgpService {

    private static final String SITE_NAME = "Photlas";

    private final PhotoRepository photoRepository;
    private final UserRepository userRepository;
    private final S3Service s3Service;
    private final String frontendUrl;

    public PhotoOgpService(
            PhotoRepository photoRepository,
            UserRepository userRepository,
            S3Service s3Service,
            @Value("${app.frontend-url}") String frontendUrl) {
        this.photoRepository = photoRepository;
        this.userRepository = userRepository;
        this.s3Service = s3Service;
        this.frontendUrl = frontendUrl;
    }

    /**
     * 写真 ID から OGP メタを組み立てる。
     *
     * @param photoId 写真 ID
     * @return 公開済み・オーナー有効なら OGP メタ、そうでなければ空
     */
    public Optional<PhotoOgpMeta> buildForPhoto(Long photoId) {
        Optional<Photo> photoOpt = photoRepository.findById(photoId);
        if (photoOpt.isEmpty()) {
            return Optional.empty();
        }
        Photo photo = photoOpt.get();

        // 非公開写真は対象外（OgpController と同基準）
        if (!Integer.valueOf(CodeConstants.MODERATION_STATUS_PUBLISHED).equals(photo.getModerationStatus())) {
            return Optional.empty();
        }
        // 退会済み・永久停止ユーザーの写真は対象外
        User owner = userRepository.findById(photo.getUserId()).orElse(null);
        if (owner == null
                || owner.getDeletedAt() != null
                || Integer.valueOf(CodeConstants.ROLE_SUSPENDED).equals(owner.getRole())) {
            return Optional.empty();
        }

        // クローラ向けにサムネイル URL を使用（元画像は大きくタイムアウトしうるため）
        String thumbnailUrl = s3Service.generateThumbnailCdnUrl(photo.getS3ObjectKey());
        String imageUrl = thumbnailUrl != null ? thumbnailUrl : s3Service.generateCdnUrl(photo.getS3ObjectKey());
        String title = photo.getPlaceName() != null
                ? photo.getPlaceName() + " - " + SITE_NAME
                : SITE_NAME;
        String description = owner.getUsername() + "さんが撮影した写真 - " + SITE_NAME;
        String pageUrl = frontendUrl + "/photo-viewer/" + photoId;

        return Optional.of(new PhotoOgpMeta(title, description, imageUrl, pageUrl));
    }
}
