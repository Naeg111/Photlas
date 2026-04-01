package com.photlas.backend.controller;

import com.photlas.backend.dto.SpotResponse;
import com.photlas.backend.service.SpotService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * スポット関連のエンドポイントを提供するコントローラー
 */
@RestController
@RequestMapping("/api/v1/spots")
public class SpotController {

    private static final Logger logger = LoggerFactory.getLogger(SpotController.class);

    private final SpotService spotService;

    public SpotController(SpotService spotService) {
        this.spotService = spotService;
    }

    /**
     * 地図範囲内のスポット一覧を取得する
     *
     * @param north 北緯
     * @param south 南緯
     * @param east 東経
     * @param west 西経
     * @param subjectCategories 被写体カテゴリーフィルター
     * @param months 月フィルター
     * @param timesOfDay 時間帯フィルター
     * @param weathers 天気フィルター
     * @param minResolution 最小解像度（長辺px）
     * @param deviceTypes 機材種別リスト（SLR / MIRRORLESS / COMPACT / SMARTPHONE / FILM / OTHER）
     * @param maxAgeDays 撮影日からの最大年数
     * @param aspectRatios アスペクト比リスト（HORIZONTAL / VERTICAL / SQUARE）
     * @param focalLengthRanges 焦点距離帯リスト（WIDE / STANDARD / TELEPHOTO / SUPER_TELEPHOTO）
     * @param maxIso 最大ISO感度
     * @return スポット一覧
     */
    @GetMapping
    public ResponseEntity<List<SpotResponse>> getSpots(
            @RequestParam BigDecimal north,
            @RequestParam BigDecimal south,
            @RequestParam BigDecimal east,
            @RequestParam BigDecimal west,
            @RequestParam(name = "subject_categories", required = false) List<Integer> subjectCategories,
            @RequestParam(required = false) List<Integer> months,
            @RequestParam(name = "times_of_day", required = false) List<String> timesOfDay,
            @RequestParam(required = false) List<String> weathers,
            @RequestParam(name = "min_resolution", required = false) Integer minResolution,
            @RequestParam(name = "device_types", required = false) List<String> deviceTypes,
            @RequestParam(name = "max_age_days", required = false) Integer maxAgeDays,
            @RequestParam(name = "aspect_ratios", required = false) List<String> aspectRatios,
            @RequestParam(name = "focal_length_ranges", required = false) List<String> focalLengthRanges,
            @RequestParam(name = "max_iso", required = false) Integer maxIso) {

        logger.info("GET /api/v1/spots - north={}, south={}, east={}, west={}, subjectCategories={}, months={}, timesOfDay={}, weathers={}, minResolution={}, deviceTypes={}, maxAgeDays={}, aspectRatios={}, focalLengthRanges={}, maxIso={}",
                north, south, east, west, subjectCategories, months, timesOfDay, weathers, minResolution, deviceTypes, maxAgeDays, aspectRatios, focalLengthRanges, maxIso);

        // 範囲パラメータのバリデーション
        if (north == null || south == null || east == null || west == null) {
            logger.warn("Missing required bounds parameters");
            return ResponseEntity.badRequest().build();
        }

        List<SpotResponse> spots = spotService.getSpots(north, south, east, west, subjectCategories, months, timesOfDay, weathers,
                minResolution, deviceTypes, maxAgeDays, aspectRatios, focalLengthRanges, maxIso);

        return ResponseEntity.ok(spots);
    }

    /**
     * Issue#14: スポットの写真ID一覧を取得
     *
     * @param spotId スポットID
     * @return 写真IDのリスト（撮影日時の新しい順）
     */
    @GetMapping("/{spotId}/photos")
    public ResponseEntity<List<Long>> getSpotPhotoIds(
            @PathVariable Long spotId,
            @RequestParam(name = "max_age_days", required = false) Integer maxAgeDays) {
        logger.info("GET /api/v1/spots/{}/photos - maxAgeDays={}", spotId, maxAgeDays);

        List<Long> photoIds = spotService.getSpotPhotoIds(spotId, maxAgeDays);

        return ResponseEntity.ok(photoIds);
    }
}
