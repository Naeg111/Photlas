package com.photlas.backend.service;

import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Issue#72: 退会済みアカウントの90日後物理削除サービス
 * deleted_atから90日以上経過したユーザーを物理削除する。
 */
@Service
public class AccountCleanupService {

    private static final Logger logger = LoggerFactory.getLogger(AccountCleanupService.class);
    private static final int RETENTION_DAYS = 90;

    private final UserRepository userRepository;
    private final PhotoRepository photoRepository;
    private final SpotRepository spotRepository;
    private final S3Service s3Service;

    public AccountCleanupService(UserRepository userRepository, PhotoRepository photoRepository,
                                  SpotRepository spotRepository, S3Service s3Service) {
        this.userRepository = userRepository;
        this.photoRepository = photoRepository;
        this.spotRepository = spotRepository;
        this.s3Service = s3Service;
    }

    /**
     * 退会済みアカウントの物理削除を実行する
     * 毎日午前4時（JST）= UTC 19:00 に実行
     */
    @Scheduled(cron = "0 0 19 * * *")
    @Transactional
    public void cleanupDeletedAccounts() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(RETENTION_DAYS);
        List<User> expiredUsers = userRepository.findByDeletedAtIsNotNullAndDeletedAtBefore(cutoff);

        if (expiredUsers.isEmpty()) {
            logger.info("削除対象の退会済みユーザーはいません");
            return;
        }

        int deletedCount = 0;
        for (User user : expiredUsers) {
            try {
                // S3の写真ファイルを削除（元画像 + サムネイル）
                List<Photo> photos = photoRepository.findByUserId(user.getId());
                for (Photo photo : photos) {
                    try {
                        s3Service.deleteS3Object(photo.getS3ObjectKey());
                        s3Service.deleteS3Object(generateThumbnailKey(photo.getS3ObjectKey()));
                    } catch (Exception e) {
                        logger.error("S3写真削除に失敗: photoId={}, s3Key={}",
                                photo.getPhotoId(), photo.getS3ObjectKey(), e);
                    }
                }

                // S3のプロフィール画像を削除
                if (user.getProfileImageS3Key() != null) {
                    try {
                        s3Service.deleteS3Object(user.getProfileImageS3Key());
                    } catch (Exception e) {
                        logger.error("S3プロフィール画像削除に失敗: userId={}, s3Key={}",
                                user.getId(), user.getProfileImageS3Key(), e);
                    }
                }

                // 写真をDB上から削除（PhotoエンティティにFKリレーションがないためCASCADE不可）
                if (!photos.isEmpty()) {
                    photoRepository.deleteAll(photos);
                }

                // ユーザーを物理削除
                userRepository.delete(user);
                deletedCount++;
            } catch (Exception e) {
                logger.error("ユーザー物理削除に失敗（翌日リトライ）: userId={}", user.getId(), e);
            }
        }

        // 孤立スポットのクリーンアップ
        spotRepository.deleteOrphanedSpots();

        logger.info("退会済みアカウントの物理削除完了: {}件", deletedCount);
    }

    private String generateThumbnailKey(String s3ObjectKey) {
        int dotIndex = s3ObjectKey.lastIndexOf('.');
        String baseName = dotIndex > 0 ? s3ObjectKey.substring(0, dotIndex) : s3ObjectKey;
        return "thumbnails/" + baseName + ".webp";
    }
}
