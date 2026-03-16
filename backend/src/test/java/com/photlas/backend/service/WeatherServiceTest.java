package com.photlas.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WeatherServiceのユニットテスト
 * 現在のモック実装では常に "Unknown" を返すことを検証する
 */
public class WeatherServiceTest {

    private final WeatherService weatherService = new WeatherService();

    @Test
    @DisplayName("有効なパラメータで \"Unknown\" が返される")
    void getWeather_ValidParameters_ReturnsUnknown() {
        // Given
        BigDecimal latitude = new BigDecimal("35.681236");
        BigDecimal longitude = new BigDecimal("139.767125");
        LocalDateTime takenAt = LocalDateTime.of(2026, 1, 15, 14, 30);

        // When
        String result = weatherService.getWeather(latitude, longitude, takenAt);

        // Then
        assertThat(result).isEqualTo("Unknown");
    }

    @Test
    @DisplayName("nullパラメータで \"Unknown\" が返される")
    void getWeather_NullParameters_ReturnsUnknown() {
        // When
        String result = weatherService.getWeather(null, null, null);

        // Then
        assertThat(result).isEqualTo("Unknown");
    }

    @Test
    @DisplayName("例外発生時も \"Unknown\" が返される")
    void getWeather_HandlesExceptionsGracefully() {
        // Given: 正常なパラメータでも内部で例外が発生した場合を想定
        // 現在のモック実装ではtry-catchで例外を捕捉して "Unknown" を返す
        BigDecimal latitude = new BigDecimal("90.000001");
        BigDecimal longitude = new BigDecimal("180.000001");
        LocalDateTime takenAt = LocalDateTime.of(1900, 1, 1, 0, 0);

        // When
        String result = weatherService.getWeather(latitude, longitude, takenAt);

        // Then
        assertThat(result).isEqualTo("Unknown");
    }
}
