package com.photlas.backend.service;

import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.entity.CodeConstants;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.rekognition.model.Label;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Issue#119: AWS Rekognition のラベル検出結果を Photlas のカテゴリ・天候コードにマッピングする。
 *
 * <p>マッピングルール詳細は Issue#119 の 4.1 / 4.2 を参照。</p>
 *
 * <p>主な責務:</p>
 * <ul>
 *   <li>信頼度70%未満のラベルを除外</li>
 *   <li>ラベル名 → Photlas カテゴリ/天候コードへの辞書ベース変換（大文字小文字を無視）</li>
 *   <li>「夜景」の組合せ判定（Night + City/Building/Architecture）</li>
 *   <li>「野鳥」の二重候補（Bird → 動物 207 + 野鳥 208）</li>
 *   <li>天候は信頼度最高ラベルを単一採用</li>
 * </ul>
 */
@Component
public class RekognitionLabelMapper {

    /** Issue#119 4.5: Rekognition 呼び出し時の MinConfidence と同値。70% 未満は除外する。 */
    private static final float CONFIDENCE_THRESHOLD = 70f;

    /** 「夜景」組合せ判定用の親ラベル（このラベル単独ではマッピングしない）。 */
    private static final String NIGHT_LABEL = "night";

    /** 「夜景」と組み合わせて 204 を成立させる相棒ラベル群。 */
    private static final Set<String> NIGHT_VIEW_PARTNER_LABELS = Set.of(
            "city", "building", "architecture"
    );

    /** Rekognition ラベル（小文字） → Photlas カテゴリコード配列。 */
    private static final Map<String, List<Integer>> LABEL_TO_CATEGORIES = Map.ofEntries(
            // 自然風景 (201)
            Map.entry("mountain", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("sea", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("river", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("forest", List.of(CodeConstants.CATEGORY_NATURE)),
            Map.entry("landscape", List.of(CodeConstants.CATEGORY_NATURE)),
            // 街並み (202)
            Map.entry("city", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("skyline", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("urban", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            Map.entry("cityscape", List.of(CodeConstants.CATEGORY_CITYSCAPE)),
            // 建造物 (203)
            Map.entry("building", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("architecture", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("bridge", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("tower", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            Map.entry("skyscraper", List.of(CodeConstants.CATEGORY_ARCHITECTURE)),
            // グルメ (205)
            Map.entry("food", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("meal", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("restaurant", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("dish", List.of(CodeConstants.CATEGORY_GOURMET)),
            Map.entry("cuisine", List.of(CodeConstants.CATEGORY_GOURMET)),
            // 植物 (206)
            Map.entry("flower", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("plant", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("tree", List.of(CodeConstants.CATEGORY_PLANTS)),
            Map.entry("garden", List.of(CodeConstants.CATEGORY_PLANTS)),
            // 動物 (207)
            Map.entry("animal", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("dog", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("cat", List.of(CodeConstants.CATEGORY_ANIMALS)),
            Map.entry("mammal", List.of(CodeConstants.CATEGORY_ANIMALS)),
            // 動物 + 野鳥 (207 + 208) - Bird は二重候補
            Map.entry("bird", List.of(CodeConstants.CATEGORY_ANIMALS, CodeConstants.CATEGORY_WILD_BIRDS)),
            // 自動車 (209)
            Map.entry("car", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("vehicle", List.of(CodeConstants.CATEGORY_CARS)),
            Map.entry("automobile", List.of(CodeConstants.CATEGORY_CARS)),
            // バイク (210)
            Map.entry("motorcycle", List.of(CodeConstants.CATEGORY_MOTORCYCLES)),
            // 鉄道 (211)
            Map.entry("train", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            Map.entry("railway", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            Map.entry("locomotive", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            Map.entry("subway", List.of(CodeConstants.CATEGORY_RAILWAYS)),
            // 飛行機 (212)
            Map.entry("aircraft", List.of(CodeConstants.CATEGORY_AIRCRAFT)),
            Map.entry("airplane", List.of(CodeConstants.CATEGORY_AIRCRAFT)),
            Map.entry("helicopter", List.of(CodeConstants.CATEGORY_AIRCRAFT)),
            // 星空 (213)
            Map.entry("star", List.of(CodeConstants.CATEGORY_STARRY_SKY)),
            Map.entry("night sky", List.of(CodeConstants.CATEGORY_STARRY_SKY)),
            Map.entry("milky way", List.of(CodeConstants.CATEGORY_STARRY_SKY))
    );

    /** Rekognition ラベル（小文字） → Photlas 天候コード。 */
    private static final Map<String, Integer> LABEL_TO_WEATHER = Map.of(
            "blue sky", CodeConstants.WEATHER_SUNNY,
            "sunshine", CodeConstants.WEATHER_SUNNY,
            "clear", CodeConstants.WEATHER_SUNNY,
            "cloud", CodeConstants.WEATHER_CLOUDY,
            "overcast", CodeConstants.WEATHER_CLOUDY,
            "rain", CodeConstants.WEATHER_RAIN,
            "wet", CodeConstants.WEATHER_RAIN,
            "snow", CodeConstants.WEATHER_SNOW,
            "winter", CodeConstants.WEATHER_SNOW
    );

    /**
     * Rekognition のラベル一覧を Photlas のカテゴリ・天候へマッピングする。
     *
     * @param labels Rekognition {@code DetectLabels} API の戻り値（{@code response.labels()}）
     * @return マッピング結果。信頼度70%未満のラベルは除外される。
     */
    public LabelMappingResult map(List<Label> labels) {
        List<Label> qualified = labels.stream()
                .filter(l -> l.confidence() != null && l.confidence() >= CONFIDENCE_THRESHOLD)
                .toList();

        Set<Integer> categories = new LinkedHashSet<>();
        Map<String, Float> confidence = new LinkedHashMap<>();

        boolean hasNightLabel = false;
        float nightConfidence = 0f;
        boolean hasNightPartner = false;
        float nightPartnerConfidence = 0f;

        for (Label label : qualified) {
            String name = label.name().toLowerCase(Locale.ROOT);
            float conf = label.confidence();

            if (NIGHT_LABEL.equals(name)) {
                hasNightLabel = true;
                nightConfidence = conf;
                // Night 単独ではカテゴリにマッピングしない（夜景の組合せ判定でのみ使用）
                continue;
            }

            if (NIGHT_VIEW_PARTNER_LABELS.contains(name)) {
                hasNightPartner = true;
                nightPartnerConfidence = Math.max(nightPartnerConfidence, conf);
            }

            List<Integer> mapped = LABEL_TO_CATEGORIES.get(name);
            if (mapped != null) {
                for (Integer code : mapped) {
                    categories.add(code);
                    confidence.merge(String.valueOf(code), conf, Math::max);
                }
            }
        }

        // 夜景: Night + (City | Building | Architecture) の組合せが揃った場合のみ追加
        if (hasNightLabel && hasNightPartner) {
            categories.add(CodeConstants.CATEGORY_NIGHT_VIEW);
            // 組合せの「弱い側」を信頼度として記録（両方が揃って初めて成立するため）
            confidence.put(
                    String.valueOf(CodeConstants.CATEGORY_NIGHT_VIEW),
                    Math.min(nightConfidence, nightPartnerConfidence)
            );
        }

        // 天候: 70%以上のラベルから信頼度最高のものを単一採用
        Integer weather = null;
        float bestWeatherConfidence = -1f;
        for (Label label : qualified) {
            String name = label.name().toLowerCase(Locale.ROOT);
            Integer code = LABEL_TO_WEATHER.get(name);
            if (code != null && label.confidence() > bestWeatherConfidence) {
                weather = code;
                bestWeatherConfidence = label.confidence();
            }
        }
        if (weather != null) {
            confidence.put(String.valueOf(weather), bestWeatherConfidence);
        }

        return new LabelMappingResult(
                new ArrayList<>(categories),
                weather,
                confidence
        );
    }
}
