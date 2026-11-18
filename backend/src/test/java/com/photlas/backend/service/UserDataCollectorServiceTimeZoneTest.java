package com.photlas.backend.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.TimeZone;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Spec#169 - エクスポートで、作成時刻などを UTC に直す処理（{@code UserDataCollectorService.toUtc}）のテスト（DB 不要）。
 *
 * 要件:
 *   - 作成時刻などは、サーバーが LocalDateTime.now()（JVM の既定のタイムゾーン）で記録した時刻なので、
 *     日本時間とみなさず、記録したときのタイムゾーンのまま読んで UTC に直す
 *   - 本番の JVM は UTC なので、保存されている時刻がそのまま UTC になる（9 時間ずらさない）
 *
 * JVM の既定のタイムゾーンを一時的に切り替えるため、各テストの後で元に戻す。
 */
class UserDataCollectorServiceTimeZoneTest {

    private TimeZone originalDefault;

    @BeforeEach
    void saveDefaultTimeZone() {
        originalDefault = TimeZone.getDefault();
    }

    @AfterEach
    void restoreDefaultTimeZone() {
        TimeZone.setDefault(originalDefault);
    }

    @Test
    @DisplayName("Spec#169 - JVM が UTC（本番と同じ）なら、保存されている時刻をそのまま UTC として出す")
    void storedTimeIsTreatedAsUtcWhenJvmIsUtc() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

        Instant result = UserDataCollectorService.toUtc(LocalDateTime.of(2026, 11, 15, 13, 40, 0));

        assertThat(result).isEqualTo(Instant.parse("2026-11-15T13:40:00Z"));
    }

    @Test
    @DisplayName("Spec#169 - JVM が Asia/Tokyo（手元の Mac など）なら、保存されている時刻を日本時間として読んで UTC に直す")
    void storedTimeIsTreatedAsJstWhenJvmIsTokyo() {
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));

        Instant result = UserDataCollectorService.toUtc(LocalDateTime.of(2026, 11, 15, 22, 40, 0));

        assertThat(result).isEqualTo(Instant.parse("2026-11-15T13:40:00Z"));
    }

    @Test
    @DisplayName("Spec#169 - LocalDateTime.now() で記録した時刻は、今の瞬間と同じ UTC になる")
    void nowIsConvertedToCurrentInstant() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

        Instant result = UserDataCollectorService.toUtc(LocalDateTime.now());

        assertThat(Duration.between(result, Instant.now()).abs()).isLessThan(Duration.ofSeconds(5));
    }

    @Test
    @DisplayName("Spec#169 - null は null のまま返す")
    void nullStaysNull() {
        assertThat(UserDataCollectorService.toUtc(null)).isNull();
    }
}
