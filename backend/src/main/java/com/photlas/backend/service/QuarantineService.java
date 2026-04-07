package com.photlas.backend.service;

import com.photlas.backend.entity.Photo;
import com.photlas.backend.repository.PhotoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Issue#54: S3隔離/復元サービス
 * 写真の隔離（quarantined/プレフィックスへの移動）と復元を管理する
 */
@Service
public class QuarantineService {

    private static final Logger logger = LoggerFactory.getLogger(QuarantineService.class);
    static final String QUARANTINED_PREFIX = "quarantined/";
    private static final String THUMBNAILS_PREFIX = "thumbnails/";

    private final S3Service s3Service;
    private final PhotoRepository photoRepository;

    public QuarantineService(S3Service s3Service, PhotoRepository photoRepository) {
        this.s3Service = s3Service;
        this.photoRepository = photoRepository;
    }

    /**
     * 写真を隔離する
     * 元画像とサムネイルをquarantined/プレフィックスに移動し、DBのs3_object_keyを更新する
     *
     * @param photo 隔離対象の写真
     */
    public void quarantinePhoto(Photo photo) {
        String originalKey = photo.getS3ObjectKey();
        String quarantinedKey = toQuarantinedKey(originalKey);

        // 元画像を移動
        s3Service.moveS3Object(originalKey, quarantinedKey);

        // サムネイルを移動
        String thumbnailKey = toThumbnailKey(originalKey);
        String quarantinedThumbnailKey = toQuarantinedKey(thumbnailKey);
        s3Service.moveS3Object(thumbnailKey, quarantinedThumbnailKey);

        // DBのs3_object_keyを更新
        photo.setS3ObjectKey(quarantinedKey);
        photoRepository.save(photo);

        logger.info("写真を隔離しました: photoId={}, {} → {}", photo.getPhotoId(), originalKey, quarantinedKey);
    }

    /**
     * 隔離された写真を復元する
     * quarantined/プレフィックスから元の場所に移動し、DBのs3_object_keyを更新する
     *
     * @param photo 復元対象の写真
     */
    public void restorePhoto(Photo photo) {
        String quarantinedKey = photo.getS3ObjectKey();
        String restoredKey = fromQuarantinedKey(quarantinedKey);

        // 元画像を復元
        s3Service.moveS3Object(quarantinedKey, restoredKey);

        // サムネイルを復元（元キーからサムネイルパスを導出し、隔離プレフィックスを付与）
        String restoredThumbnailKey = toThumbnailKey(restoredKey);
        String quarantinedThumbnailKey = toQuarantinedKey(restoredThumbnailKey);
        s3Service.moveS3Object(quarantinedThumbnailKey, restoredThumbnailKey);

        // DBのs3_object_keyを更新
        photo.setS3ObjectKey(restoredKey);
        photoRepository.save(photo);

        logger.info("写真を復元しました: photoId={}, {} → {}", photo.getPhotoId(), quarantinedKey, restoredKey);
    }

    /**
     * S3キーがquarantined/プレフィックスで始まるかどうかを判定する
     *
     * @param s3Key S3オブジェクトキー
     * @return quarantined/プレフィックス付きの場合true
     */
    public boolean isQuarantined(String s3Key) {
        return s3Key != null && s3Key.startsWith(QUARANTINED_PREFIX);
    }

    /**
     * S3キーにquarantined/プレフィックスを付与する
     *
     * @param s3Key 元のS3キー
     * @return quarantined/プレフィックス付きのS3キー
     */
    String toQuarantinedKey(String s3Key) {
        if (s3Key == null || s3Key.startsWith(QUARANTINED_PREFIX)) {
            return s3Key;
        }
        return QUARANTINED_PREFIX + s3Key;
    }

    /**
     * S3キーからquarantined/プレフィックスを除去する
     *
     * @param s3Key quarantined/プレフィックス付きのS3キー
     * @return 元のS3キー
     */
    String fromQuarantinedKey(String s3Key) {
        if (s3Key == null || !s3Key.startsWith(QUARANTINED_PREFIX)) {
            return s3Key;
        }
        return s3Key.substring(QUARANTINED_PREFIX.length());
    }

    /**
     * 元画像のS3キーからサムネイルのS3キーを導出する
     * 例: uploads/1/abc.jpg → thumbnails/uploads/1/abc.webp
     *
     * @param originalKey 元画像のS3キー
     * @return サムネイルのS3キー
     */
    String toThumbnailKey(String originalKey) {
        if (originalKey == null) {
            return null;
        }
        int dotIndex = originalKey.lastIndexOf('.');
        String baseName = dotIndex > 0 ? originalKey.substring(0, dotIndex) : originalKey;
        return THUMBNAILS_PREFIX + baseName + ".webp";
    }
}
