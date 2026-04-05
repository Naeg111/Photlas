package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.repository.PhotoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Issue#54: REMOVED投稿の物理削除サービス
 * REMOVEDステータスに変更されてから180日経過した写真を物理削除する
 * Issue#62: S3オブジェクト（元画像・サムネイル）も同時に削除する
 */
@Service
public class RemovedPhotoCleanupService {

    private static final Logger logger = LoggerFactory.getLogger(RemovedPhotoCleanupService.class);
    private static final int RETENTION_DAYS = 180;

    private final PhotoRepository photoRepository;
    private final S3Service s3Service;

    public RemovedPhotoCleanupService(PhotoRepository photoRepository, S3Service s3Service) {
        this.photoRepository = photoRepository;
        this.s3Service = s3Service;
    }

    /**
     * REMOVED投稿の物理削除を実行する
     * 毎日午前3時に実行される
     */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void cleanupRemovedPhotos() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(RETENTION_DAYS);
        List<Photo> expiredPhotos = photoRepository.findByModerationStatusAndUpdatedAtBefore(
                CodeConstants.MODERATION_STATUS_REMOVED, threshold);

        if (expiredPhotos.isEmpty()) {
            logger.info("削除対象のREMOVED写真はありません");
            return;
        }

        // Issue#62: 写真ごとにS3削除を実行し、成功した写真のみDB削除対象に追加
        List<Photo> s3DeletedPhotos = new ArrayList<>();
        for (Photo photo : expiredPhotos) {
            try {
                // 元画像を削除
                s3Service.deleteS3Object(photo.getS3ObjectKey());
                // サムネイルを削除
                s3Service.deleteS3Object(generateThumbnailKey(photo.getS3ObjectKey()));
                s3DeletedPhotos.add(photo);
            } catch (Exception e) {
                logger.error("S3削除に失敗しました（翌日リトライ）: photoId={}, s3Key={}",
                        photo.getPhotoId(), photo.getS3ObjectKey(), e);
            }
        }

        if (!s3DeletedPhotos.isEmpty()) {
            photoRepository.deleteAll(s3DeletedPhotos);
            logger.info("REMOVED写真の物理削除完了: {}件（S3削除失敗: {}件）",
                    s3DeletedPhotos.size(), expiredPhotos.size() - s3DeletedPhotos.size());
        }
    }

    /**
     * 元画像のS3キーからサムネイルのS3キーを生成する
     */
    private String generateThumbnailKey(String s3ObjectKey) {
        int dotIndex = s3ObjectKey.lastIndexOf('.');
        String baseName = dotIndex > 0 ? s3ObjectKey.substring(0, dotIndex) : s3ObjectKey;
        return "thumbnails/" + baseName + ".webp";
    }
}
