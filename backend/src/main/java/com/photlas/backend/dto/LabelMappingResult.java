package com.photlas.backend.dto;

import java.util.List;
import java.util.Map;

/**
 * Issue#119: AWS Rekognition のラベル検出結果を Photlas のカテゴリ・天候コードにマッピングした結果。
 *
 * <p>{@link com.photlas.backend.service.RekognitionLabelMapper} の出力。</p>
 *
 * @param categories Photlas カテゴリコード（200番台）の配列。信頼度70%以上のもののみ。空配列もあり得る。
 * @param weather    Photlas 天候コード（400番台）。判定不可なら null。
 * @param confidence カテゴリ・天候コード（文字列キー）→ 信頼度（0-100）のマップ。例: {"201": 92.5, "401": 85.0}
 */
public record LabelMappingResult(
        List<Integer> categories,
        Integer weather,
        Map<String, Float> confidence
) {
}
