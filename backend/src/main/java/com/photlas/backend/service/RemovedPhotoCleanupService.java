package com.photlas.backend.service;

import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.repository.PhotoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Issue#54: REMOVED投稿の物理削除サービス
 * REMOVEDステータスに変更されてから180日経過した写真を物理削除する
 */
@Service
public class RemovedPhotoCleanupService {

    private static final Logger logger = LoggerFactory.getLogger(RemovedPhotoCleanupService.class);
    private static final int RETENTION_DAYS = 180;

    private final PhotoRepository photoRepository;

    public RemovedPhotoCleanupService(PhotoRepository photoRepository) {
        this.photoRepository = photoRepository;
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
                ModerationStatus.REMOVED, threshold);

        if (expiredPhotos.isEmpty()) {
            logger.info("削除対象のREMOVED写真はありません");
            return;
        }

        photoRepository.deleteAll(expiredPhotos);
        logger.info("REMOVED写真の物理削除完了: {}件", expiredPhotos.size());
    }
}
