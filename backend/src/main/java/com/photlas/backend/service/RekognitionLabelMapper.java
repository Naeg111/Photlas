package com.photlas.backend.service;

import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.dto.ParentFallback;
import com.photlas.backend.entity.CodeConstants;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.rekognition.model.Label;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Issue#119: AWS Rekognition のラベル検出結果を Photlas のカテゴリ・天候コードにマッピングする。
 *
 * <p>マッピングルール詳細は Issue#119 の 4.1 / 4.2、Issue#132 の 3.2 を参照。
 * 辞書（ラベル → カテゴリ/天候/BL）は {@link CategoryDictionary} に分離している。</p>
 *
 * <p>主な責務:</p>
 * <ul>
 *   <li>信頼度80%未満のラベルを除外</li>
 *   <li>ラベル名 → Photlas カテゴリ/天候コードへの辞書ベース変換（大文字小文字を無視）</li>
 *   <li>Issue#132: 子ラベル未マッチ時の親ラベルフォールバック（信頼度 × 0.8、BL あり）</li>
 *   <li>「夜景」の組合せ判定（Night + City/Building/Architecture）</li>
 *   <li>「野鳥」の二重候補（Bird → 動物 207 + 野鳥 208）</li>
 *   <li>天候は信頼度最高ラベルを単一採用</li>
 * </ul>
 */
@Component
public class RekognitionLabelMapper {

    /** Issue#119 4.5: Rekognition 呼び出し時の MinConfidence と同値。80% 未満は除外する。 */
    private static final float CONFIDENCE_THRESHOLD = 80f;

    /** 「夜景」組合せ判定用の親ラベル（このラベル単独ではマッピングしない）。 */
    private static final String NIGHT_LABEL = "night";

    /** 「夜景」と組み合わせて 204 を成立させる相棒ラベル群。 */
    private static final Set<String> NIGHT_VIEW_PARTNER_LABELS = Set.of(
            "city", "building", "architecture"
    );

    /**
     * Issue#132 3.2: 親ラベル経由マッピングの信頼度減衰係数。
     * 親は子より広い概念なので不確実性が高いため 0.8 倍する。
     */
    private static final float PARENT_FALLBACK_DECAY = 0.8f;

    /**
     * Rekognition のラベル一覧を Photlas のカテゴリ・天候へマッピングする（イベント追跡なし）。
     *
     * @param labels Rekognition {@code DetectLabels} API の戻り値（{@code response.labels()}）
     * @return マッピング結果。信頼度80%未満のラベルは除外される。
     */
    public LabelMappingResult map(List<Label> labels) {
        return mapWithEvents(labels).result();
    }

    /**
     * Issue#132: マッピング結果に加え、親フォールバック発火イベントも返す。
     * GA4 への送信用イベント情報を必要とする呼び出し元はこちらを使う。
     */
    public MappingResult mapWithEvents(List<Label> labels) {
        List<Label> qualified = filterByConfidence(labels);
        List<ParentFallback> parentFallbacks = new ArrayList<>();
        CategoryMapping categoryMapping = mapCategories(qualified, parentFallbacks);
        WeatherMapping weatherMapping = mapWeather(qualified);
        return new MappingResult(combine(categoryMapping, weatherMapping), parentFallbacks);
    }

    /**
     * Issue#132: {@link #mapWithEvents} の戻り値。
     *
     * @param result          従来のカテゴリ・天候マッピング結果
     * @param parentFallbacks 親ラベル経由でマッピングが成立した発火イベント一覧
     */
    public record MappingResult(LabelMappingResult result, List<ParentFallback> parentFallbacks) {
    }

    private static List<Label> filterByConfidence(List<Label> labels) {
        return labels.stream()
                .filter(l -> l.confidence() != null && l.confidence() >= CONFIDENCE_THRESHOLD)
                .toList();
    }

    private static String normalize(String labelName) {
        return labelName.toLowerCase(Locale.ROOT);
    }

    /**
     * ラベル群からカテゴリ群を構築する（夜景の組合せ判定と Issue#132 親フォールバックを含む）。
     * 親フォールバックの発火は引数 {@code parentFallbacks} に追記する。
     */
    private static CategoryMapping mapCategories(
            List<Label> qualified, List<ParentFallback> parentFallbacks) {
        Set<Integer> codes = new LinkedHashSet<>();
        Map<String, Float> confidence = new LinkedHashMap<>();
        NightViewState nightViewState = new NightViewState();

        for (Label label : qualified) {
            String name = normalize(label.name());
            float conf = label.confidence();

            if (NIGHT_LABEL.equals(name)) {
                nightViewState.recordNight(conf);
                continue;
            }
            if (NIGHT_VIEW_PARTNER_LABELS.contains(name)) {
                nightViewState.recordPartner(conf);
            }

            List<Integer> mapped = CategoryDictionary.LABEL_TO_CATEGORIES.get(name);
            if (mapped != null) {
                applyCodes(codes, confidence, mapped, conf);
                continue;
            }

            // Issue#132 3.2: 子ラベル未マッチ → 親ラベルを順に検索（最初のヒットを採用）
            findParentFallbackCodes(label).ifPresent(parentHit -> {
                applyCodes(codes, confidence, parentHit.codes(), conf * PARENT_FALLBACK_DECAY);
                // Issue#132 3.4.1: 1 つの子から複数カテゴリへマッピングされる場合は各カテゴリで別イベント
                for (Integer code : parentHit.codes()) {
                    parentFallbacks.add(new ParentFallback(label.name(), parentHit.parentDisplayName(), code));
                }
            });
        }

        nightViewState.applyTo(codes, confidence);
        return new CategoryMapping(codes, confidence);
    }

    /** カテゴリ群と信頼度マップに、与えられたコード群を追加する（既存値とは最大値マージ）。 */
    private static void applyCodes(
            Set<Integer> codes, Map<String, Float> confidence,
            List<Integer> mapped, float conf) {
        for (Integer code : mapped) {
            codes.add(code);
            confidence.merge(String.valueOf(code), conf, Math::max);
        }
    }

    /**
     * Issue#132 3.2: 親ラベルを順に検索し、ブラックリストでない最初のヒットを返す。
     * 該当なしなら空 Optional。
     */
    private static Optional<ParentHit> findParentFallbackCodes(Label label) {
        if (label.parents() == null) {
            return Optional.empty();
        }
        for (var parent : label.parents()) {
            if (parent.name() == null) {
                continue;
            }
            String parentName = normalize(parent.name());
            if (CategoryDictionary.BLACKLISTED_PARENTS.contains(parentName)) {
                continue;
            }
            List<Integer> parentMapped = CategoryDictionary.LABEL_TO_CATEGORIES.get(parentName);
            if (parentMapped != null) {
                // parentDisplayName は元の大文字小文字をそのまま返す（GA4 イベント用）
                return Optional.of(new ParentHit(parentName, parent.name(), parentMapped));
            }
        }
        return Optional.empty();
    }

    /** 親フォールバックで採用された親ラベル名とマッピング先カテゴリ群。 */
    private record ParentHit(String parentName, String parentDisplayName, List<Integer> codes) {
    }

    /** ラベル群から信頼度最高の天候を選定する。該当なしなら code = null。 */
    private static WeatherMapping mapWeather(List<Label> qualified) {
        Integer bestCode = null;
        float bestConf = -1f;
        for (Label label : qualified) {
            Integer code = CategoryDictionary.LABEL_TO_WEATHER.get(normalize(label.name()));
            if (code != null && label.confidence() > bestConf) {
                bestCode = code;
                bestConf = label.confidence();
            }
        }
        return new WeatherMapping(bestCode, bestCode != null ? bestConf : null);
    }

    private static LabelMappingResult combine(CategoryMapping categories, WeatherMapping weather) {
        // Issue#159 ②(案A/Q4): 複合判定(夜景等)は既に codes へ反映済み。ここで最終的に
        // 「最高信頼度の 1 カテゴリー」へ絞り込む（単一選択化）。
        List<Integer> single = reduceToSingle(categories.codes(), categories.confidence());
        Map<String, Float> confidence = new LinkedHashMap<>();
        // 単一化後のカテゴリーの信頼度のみ残す。
        for (Integer code : single) {
            Float c = categories.confidence().get(String.valueOf(code));
            if (c != null) {
                confidence.put(String.valueOf(code), c);
            }
        }
        if (weather.code() != null) {
            confidence.put(String.valueOf(weather.code()), weather.confidence());
        }
        return new LabelMappingResult(single, weather.code(), confidence);
    }

    /**
     * Issue#159 ②(Q4): 候補カテゴリー群を最高信頼度の 1 件へ絞り込む。
     *
     * <ol>
     *   <li>複合判定（夜景 204 等）は呼び出し前に codes へ反映済み（本メソッドの対象に含む）。</li>
     *   <li>包含関係: 動物(207) と 野鳥(208) が両立する場合は具体的な野鳥(208)を優先し 207 を除外。</li>
     *   <li>残った候補のうち信頼度最大の 1 件を採用（同点は挿入順で先勝ち）。</li>
     * </ol>
     *
     * @return 0 件（該当なし）または 1 件のカテゴリーコード。
     */
    private static List<Integer> reduceToSingle(Set<Integer> codes, Map<String, Float> confidence) {
        if (codes.isEmpty()) {
            return List.of();
        }
        Set<Integer> working = new LinkedHashSet<>(codes);
        if (working.contains(CodeConstants.CATEGORY_ANIMALS)
                && working.contains(CodeConstants.CATEGORY_WILD_BIRDS)) {
            working.remove(CodeConstants.CATEGORY_ANIMALS);
        }
        Integer best = null;
        float bestConf = -1f;
        for (Integer code : working) {
            float c = confidence.getOrDefault(String.valueOf(code), 0f);
            if (c > bestConf) {
                bestConf = c;
                best = code;
            }
        }
        return best == null ? List.of() : List.of(best);
    }

    /** カテゴリマッピング結果（コード集合 + 信頼度マップ）。内部使用のみ。 */
    private record CategoryMapping(Set<Integer> codes, Map<String, Float> confidence) {
    }

    /** 天候マッピング結果。code が null なら採用なし。 */
    private record WeatherMapping(Integer code, Float confidence) {
    }

    /**
     * 「夜景」(204) の組合せ判定状態。Night ラベルと相棒ラベル（City/Building/Architecture）
     * の両方が信頼度80%以上で揃った場合に 204 を成立させる。
     */
    private static final class NightViewState {
        private boolean hasNight = false;
        private float nightConfidence = 0f;
        private boolean hasPartner = false;
        private float partnerConfidence = 0f;

        void recordNight(float confidence) {
            hasNight = true;
            nightConfidence = confidence;
        }

        void recordPartner(float confidence) {
            hasPartner = true;
            partnerConfidence = Math.max(partnerConfidence, confidence);
        }

        void applyTo(Set<Integer> codes, Map<String, Float> confidenceMap) {
            if (!hasNight || !hasPartner) {
                return;
            }
            codes.add(CodeConstants.CATEGORY_NIGHT_VIEW);
            // Issue#159 ②(Q4): 夜景の信頼度は「夜であることの確信度」= Night ラベルの信頼度とする。
            // partner(City/Building 等) が揃って初めて成立する前提は満たしつつ、単一選択化では
            // 夜景写真が partner の街並み/建造物より優先されるようにする。
            confidenceMap.put(
                    String.valueOf(CodeConstants.CATEGORY_NIGHT_VIEW),
                    nightConfidence
            );
        }
    }
}
