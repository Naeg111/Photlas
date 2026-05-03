package com.photlas.backend.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#108 §4.20 - ユーザー言語からタイムゾーン推定を行うユーティリティのテスト。
 *
 * 表示用日時（通知メール本文・README.md）でユーザー言語に応じたタイムゾーンに変換する
 * ためのマッピング:
 *
 * | 言語コード | タイムゾーン       |
 * |------------|--------------------|
 * | ja         | Asia/Tokyo (JST)   |
 * | ko         | Asia/Seoul (KST)   |
 * | zh         | Asia/Shanghai (CST)|
 * | th         | Asia/Bangkok (ICT) |
 * | en         | UTC                |
 * | その他/null| UTC                |
 *
 * 表示ラベル:
 *   ja → "JST"、ko → "KST"、zh → "CST"、th → "ICT"、en/その他/null → "UTC"
 */
class TimeZoneResolverTest {

    @Test
    @DisplayName("Issue#108 - ja は Asia/Tokyo")
    void japaneseMapsToTokyo() {
        assertThat(TimeZoneResolver.resolveZone("ja")).isEqualTo(ZoneId.of("Asia/Tokyo"));
    }

    @Test
    @DisplayName("Issue#108 - ko は Asia/Seoul")
    void koreanMapsToSeoul() {
        assertThat(TimeZoneResolver.resolveZone("ko")).isEqualTo(ZoneId.of("Asia/Seoul"));
    }

    @Test
    @DisplayName("Issue#108 - zh は Asia/Shanghai")
    void chineseMapsToShanghai() {
        assertThat(TimeZoneResolver.resolveZone("zh")).isEqualTo(ZoneId.of("Asia/Shanghai"));
    }

    @Test
    @DisplayName("Issue#108 - th は Asia/Bangkok")
    void thaiMapsToBangkok() {
        assertThat(TimeZoneResolver.resolveZone("th")).isEqualTo(ZoneId.of("Asia/Bangkok"));
    }

    @Test
    @DisplayName("Issue#108 - en は UTC")
    void englishMapsToUtc() {
        assertThat(TimeZoneResolver.resolveZone("en")).isEqualTo(ZoneId.of("UTC"));
    }

    @Test
    @DisplayName("Issue#108 - 未対応言語は UTC（フォールバック）")
    void unknownLanguageFallsBackToUtc() {
        assertThat(TimeZoneResolver.resolveZone("fr")).isEqualTo(ZoneId.of("UTC"));
        assertThat(TimeZoneResolver.resolveZone("de")).isEqualTo(ZoneId.of("UTC"));
    }

    @Test
    @DisplayName("Issue#108 - null 言語は UTC（フォールバック）")
    void nullLanguageFallsBackToUtc() {
        assertThat(TimeZoneResolver.resolveZone(null)).isEqualTo(ZoneId.of("UTC"));
    }

    @Test
    @DisplayName("Issue#108 - 大文字混じりの言語コードでも正しく解決される")
    void caseInsensitive() {
        assertThat(TimeZoneResolver.resolveZone("JA")).isEqualTo(ZoneId.of("Asia/Tokyo"));
        assertThat(TimeZoneResolver.resolveZone("Ja")).isEqualTo(ZoneId.of("Asia/Tokyo"));
    }

    @Test
    @DisplayName("Issue#108 - タイムゾーンの表示ラベル（JST/KST/CST/ICT/UTC）が言語ごとに返る")
    void displayLabel() {
        assertThat(TimeZoneResolver.resolveLabel("ja")).isEqualTo("JST");
        assertThat(TimeZoneResolver.resolveLabel("ko")).isEqualTo("KST");
        assertThat(TimeZoneResolver.resolveLabel("zh")).isEqualTo("CST");
        assertThat(TimeZoneResolver.resolveLabel("th")).isEqualTo("ICT");
        assertThat(TimeZoneResolver.resolveLabel("en")).isEqualTo("UTC");
        assertThat(TimeZoneResolver.resolveLabel(null)).isEqualTo("UTC");
        assertThat(TimeZoneResolver.resolveLabel("xx")).isEqualTo("UTC");
    }
}
