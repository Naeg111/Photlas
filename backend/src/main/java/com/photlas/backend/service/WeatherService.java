package com.photlas.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 天気情報を取得するサービス
 * OpenWeatherMap APIを使用して、指定された位置と時刻の天気情報を取得する
 */
@Service
public class WeatherService {

    private static final Logger logger = LoggerFactory.getLogger(WeatherService.class);

    /**
     * 指定された緯度経度と撮影日時から天気情報を取得する
     *
     * @param latitude 緯度
     * @param longitude 経度
     * @param takenAt 撮影日時
     * @return 天気情報（取得できない場合は "Unknown"）
     */
    public String getWeather(BigDecimal latitude, BigDecimal longitude, LocalDateTime takenAt) {
        try {
            // TODO: 実際の天気API連携を実装
            // 現在はモック実装として "Unknown" を返す
            // OpenWeatherMap APIの無料枠では過去の天気データの取得に制限があるため、
            // エラーハンドリングを厚くし、取得できない場合は "Unknown" を返す

            logger.info("天気情報の取得をスキップしました（モック実装）: lat={}, lon={}, takenAt={}",
                       latitude, longitude, takenAt);

            return "Unknown";
        } catch (Exception e) {
            logger.warn("天気情報の取得に失敗しました: {}", e.getMessage());
            return "Unknown";
        }
    }
}
