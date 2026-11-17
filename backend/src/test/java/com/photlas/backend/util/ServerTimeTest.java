package com.photlas.backend.util;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.TimeZone;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Spec#169 - サーバーが記録した時刻（LocalDateTime）の変換ユーティリティのテスト。
 *
 * 要件:
 *   - サーバーが LocalDateTime.now() で記録した時刻は、JVM の既定のタイムゾーンの時刻として読む
 *     （本番は UTC。日本時間とはみなさない）
 *   - API で返すときは UTC の ISO 8601（末尾 Z）にする
 *   - 外から受け取った Instant は、JVM の既定のタイムゾーンの LocalDateTime にして保存する
 *
 * JVM の既定のタイムゾーンを一時的に切り替えるため、各テストの後で元に戻す。
 */
class ServerTimeTest {

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
    @DisplayName("Spec#169 - JVM が UTC なら、保存されている時刻をそのまま UTC として読む")
    void toInstantReadsStoredTimeAsUtcWhenJvmIsUtc() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

        assertThat(ServerTime.toInstant(LocalDateTime.of(2026, 11, 15, 13, 40)))
                .isEqualTo(Instant.parse("2026-11-15T13:40:00Z"));
    }

    @Test
    @DisplayName("Spec#169 - JVM が Asia/Tokyo なら、保存されている時刻を日本時間として読む")
    void toInstantReadsStoredTimeAsJstWhenJvmIsTokyo() {
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));

        assertThat(ServerTime.toInstant(LocalDateTime.of(2026, 11, 15, 22, 40)))
                .isEqualTo(Instant.parse("2026-11-15T13:40:00Z"));
    }

    @Test
    @DisplayName("Spec#169 - API で返す文字列は UTC の ISO 8601（末尾 Z）になる")
    void toUtcIsoStringEndsWithZ() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));

        assertThat(ServerTime.toUtcIsoString(LocalDateTime.of(2026, 11, 15, 13, 40)))
                .isEqualTo("2026-11-15T13:40:00Z");
    }

    @Test
    @DisplayName("Spec#169 - Instant は JVM の既定のタイムゾーンの LocalDateTime にする")
    void fromInstantUsesJvmDefaultZone() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        assertThat(ServerTime.fromInstant(Instant.parse("2026-11-15T13:40:00Z")))
                .isEqualTo(LocalDateTime.of(2026, 11, 15, 13, 40));

        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Tokyo"));
        assertThat(ServerTime.fromInstant(Instant.parse("2026-11-15T13:40:00Z")))
                .isEqualTo(LocalDateTime.of(2026, 11, 15, 22, 40));
    }

    @Test
    @DisplayName("Spec#169 - null は null のまま返す")
    void nullStaysNull() {
        assertThat(ServerTime.toInstant(null)).isNull();
        assertThat(ServerTime.toUtcIsoString(null)).isNull();
        assertThat(ServerTime.fromInstant(null)).isNull();
    }
}
