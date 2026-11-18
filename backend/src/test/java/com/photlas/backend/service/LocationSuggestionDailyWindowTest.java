package com.photlas.backend.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.TimeZone;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Spec#169 - 撮影場所の指摘の「1日10件まで」の「1日」の区切りのテスト（DB 不要）。
 *
 * 要件:
 *   - 「1日」は日本時間の 0 時で区切る（JVM が UTC でも、日本時間 9 時で区切らない）
 *   - 返す値は、created_at と比べられるよう、JVM の既定のタイムゾーンの LocalDateTime にする
 *
 * JVM の既定のタイムゾーンを一時的に UTC（本番と同じ）にし、各テストの後で元に戻す。
 */
class LocationSuggestionDailyWindowTest {

    private TimeZone originalDefault;

    @BeforeEach
    void useUtcLikeProduction() {
        originalDefault = TimeZone.getDefault();
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }

    @AfterEach
    void restoreDefaultTimeZone() {
        TimeZone.setDefault(originalDefault);
    }

    @Test
    @DisplayName("Spec#169 - 日本時間 11/16 05:00 なら、日本時間 11/16 0:00（= UTC 11/15 15:00）から数える")
    void earlyMorningJstCountsFromJstMidnight() {
        // 2026-11-15T20:00Z = 日本時間 2026-11-16 05:00
        LocalDateTime start = LocationSuggestionService.dailyLimitWindowStart(Instant.parse("2026-11-15T20:00:00Z"));

        assertThat(start).isEqualTo(LocalDateTime.of(2026, 11, 15, 15, 0));
    }

    @Test
    @DisplayName("Spec#169 - 日本時間 11/15 23:00 なら、日本時間 11/15 0:00（= UTC 11/14 15:00）から数える")
    void lateNightJstCountsFromSameDayJstMidnight() {
        // 2026-11-15T14:00Z = 日本時間 2026-11-15 23:00
        LocalDateTime start = LocationSuggestionService.dailyLimitWindowStart(Instant.parse("2026-11-15T14:00:00Z"));

        assertThat(start).isEqualTo(LocalDateTime.of(2026, 11, 14, 15, 0));
    }
}
