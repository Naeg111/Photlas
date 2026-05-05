package com.photlas.backend.service;

import com.photlas.backend.dto.LabelMappingResult;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.rekognition.model.Label;

import java.util.List;
import java.util.Map;

/**
 * Issue#119: AWS Rekognition のラベル検出結果を Photlas のカテゴリ・天候コードにマッピングする。
 *
 * <p>マッピングルール詳細は Issue#119 の 4.1 / 4.2 を参照。</p>
 */
@Component
public class RekognitionLabelMapper {

    /**
     * Rekognition のラベル一覧を Photlas のカテゴリ・天候へマッピングする。
     *
     * @param labels Rekognition {@code DetectLabels} API の戻り値（{@code response.labels()}）
     * @return マッピング結果。信頼度70%未満のラベルは除外される。
     */
    public LabelMappingResult map(List<Label> labels) {
        // Phase 2 Red 段階: スタブ実装。テストは全て失敗する想定。
        return new LabelMappingResult(List.of(), null, Map.of());
    }
}
