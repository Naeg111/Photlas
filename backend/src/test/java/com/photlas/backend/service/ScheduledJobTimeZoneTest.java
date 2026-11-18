package com.photlas.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.scheduling.annotation.Scheduled;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Spec#169 - 定期処理が、JVM のタイムゾーン（本番は UTC）に左右されず、日本時間の決まった時刻に動くことのテスト。
 *
 * 要件:
 *   - 退会済みアカウントの物理削除は、日本時間の午前4時に動く
 *   - REMOVED 写真の物理削除と、AI 予測キャッシュの掃除は、日本時間の午前3時に動く（投稿が少ない時間帯）
 */
class ScheduledJobTimeZoneTest {

    private static final String TOKYO = "Asia/Tokyo";

    @Test
    @DisplayName("Spec#169 - 退会済みアカウントの物理削除は日本時間 4:00 に動く")
    void accountCleanupRunsAt4amJst() throws Exception {
        Scheduled scheduled = AccountCleanupService.class
                .getMethod("cleanupDeletedAccounts").getAnnotation(Scheduled.class);

        assertThat(scheduled.cron()).isEqualTo("0 0 4 * * *");
        assertThat(scheduled.zone()).isEqualTo(TOKYO);
    }

    @Test
    @DisplayName("Spec#169 - REMOVED 写真の物理削除は日本時間 3:00 に動く")
    void removedPhotoCleanupRunsAt3amJst() throws Exception {
        Scheduled scheduled = RemovedPhotoCleanupService.class
                .getMethod("cleanupRemovedPhotos").getAnnotation(Scheduled.class);

        assertThat(scheduled.cron()).isEqualTo("0 0 3 * * *");
        assertThat(scheduled.zone()).isEqualTo(TOKYO);
    }

    @Test
    @DisplayName("Spec#169 - AI 予測キャッシュの掃除は日本時間 3:00 に動く")
    void aiPredictionCacheCleanupRunsAt3amJst() throws Exception {
        Scheduled scheduled = AiPredictionCacheService.class
                .getMethod("cleanupExpired").getAnnotation(Scheduled.class);

        assertThat(scheduled.cron()).isEqualTo("0 0 3 * * *");
        assertThat(scheduled.zone()).isEqualTo(TOKYO);
    }
}
