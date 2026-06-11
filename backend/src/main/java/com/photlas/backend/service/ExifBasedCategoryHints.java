package com.photlas.backend.service;

import com.photlas.backend.dto.ExifData;
import com.photlas.backend.dto.ExifRuleFire;
import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.entity.CodeConstants;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Issue#132: EXIF 撮影情報 (R1〜R5 のルール) に基づき、カテゴリ候補の信頼度を補正する。
 *
 * <p>入力: Rekognition マッピング結果 + EXIF データ
 * 出力: 補正後のマッピング結果 + 発火したルールのイベントリスト</p>
 *
 * <p>ルール一覧:</p>
 * <ul>
 *   <li>R1 星空判定: 露光 ≥10s + ISO ≥800 + 夜間 → 213 +30、単独候補化 ✅</li>
 *   <li>R2 夜景判定: (a) 露光 ≥5s + ISO ≥800 + 夜間 / (b) ISO ≥2400 + 夜間 → 204 +20、単独候補化 ✅</li>
 *   <li>R3 望遠ヒント: 35mm 換算焦点距離 ≥200mm → 208/211/212 +10、単独候補化 ❌（Issue#142 で 207 を除外）</li>
 *   <li>R3.5 焦点距離振り分け: 208 候補時、≥300mm は 208 を加点 / &lt;300mm・欠落は 207 を加点し 208 を除去（Issue#142、R4 を置換）</li>
 *   <li>R5 山岳ヒント: GPS 標高 ≥1000m → 201 +10、単独候補化 ❌</li>
 * </ul>
 *
 * <p>「単独候補化」が ❌ のルールは、Rekognition が既に検出した候補のブーストにのみ作用する。
 * これは「望遠を使った」「標高が高い」だけでは被写体を特定できないため誤検出を抑える狙い。</p>
 *
 * <p>本クラスはステートレスで、Spring の {@code @Component} としてシングルトン管理される。</p>
 */
@Component
public class ExifBasedCategoryHints {

    private static final Logger logger = LoggerFactory.getLogger(ExifBasedCategoryHints.class);

    /** Issue#132 3.4: 新規候補を追加する際のベース信頼度。 */
    private static final float NEW_CANDIDATE_BASE_CONFIDENCE = 70f;

    /** Issue#132 3.4: 信頼度の上限。 */
    private static final float MAX_CONFIDENCE = 100f;

    /** Issue#132 R3 が +10 を加算する対象カテゴリ（Issue#142 で 207 動物を除外。望遠＝遠距離＝野生寄りの方針に合わせる）。 */
    private static final Set<Integer> R3_TARGET_CATEGORIES = Set.of(
            CodeConstants.CATEGORY_WILD_BIRDS,
            CodeConstants.CATEGORY_RAILWAYS,
            CodeConstants.CATEGORY_AIRCRAFT
    );

    // 各ルールの加算値
    private static final int R1_BOOST = 30;
    private static final int R2_BOOST = 20;
    private static final int R3_BOOST = 10;
    private static final int R3_5_BOOST = 20;
    private static final int R5_BOOST = 10;

    // 各ルールの閾値
    private static final double R1_MIN_EXPOSURE_SECONDS = 10.0;
    private static final int R1_MIN_ISO = 800;
    private static final double R2A_MIN_EXPOSURE_SECONDS = 5.0;
    private static final int R2A_MIN_ISO = 800;
    private static final int R2B_MIN_ISO = 2400;
    private static final int R3_MIN_FOCAL_35MM = 200;
    /** R3.5 の閾値。Issue#142: {@link TagService#extractSuggestions} の小カテゴリーリマップと同一閾値を共有する（同パッケージから参照）。 */
    static final int R3_5_MIN_FOCAL_35MM = 300;
    private static final double R5_MIN_ALTITUDE = 1000.0;

    // 夜間判定の境界（19:00:00 ≤ t OR t < 05:00:00）
    private static final LocalTime NIGHT_START = LocalTime.of(19, 0, 0);
    private static final LocalTime NIGHT_END = LocalTime.of(5, 0, 0);

    /**
     * Rekognition マッピング結果に EXIF ベースのスコア補正を適用する。
     *
     * @param mapped Rekognition マッピング結果（{@link RekognitionLabelMapper#map} の戻り値）
     * @param exif   EXIF データ（{@link ExifReader#read} の戻り値、空でも可）
     * @return 補正後のマッピング結果と発火イベント一覧
     */
    public Applied apply(LabelMappingResult mapped, ExifData exif) {
        // 既存値をミュータブルなコピーに展開
        List<Integer> codes = new ArrayList<>(mapped.categories());
        Map<String, Float> confidence = new LinkedHashMap<>(mapped.confidence());
        List<ExifRuleFire> fires = new ArrayList<>();

        applyR1(codes, confidence, exif, fires);
        applyR2(codes, confidence, exif, fires);
        applyR3(codes, confidence, exif, fires);
        applyR3_5(codes, confidence, exif, fires);
        applyR5(codes, confidence, exif, fires);

        LabelMappingResult result = new LabelMappingResult(codes, mapped.weather(), confidence);
        return new Applied(result, fires);
    }

    // ========== R1 星空 ==========
    private void applyR1(List<Integer> codes, Map<String, Float> confidence,
                         ExifData exif, List<ExifRuleFire> fires) {
        if (!conditionR1(exif)) {
            return;
        }
        boolean created = boostOrAdd(codes, confidence,
                CodeConstants.CATEGORY_STARRY_SKY, R1_BOOST, true);
        fires.add(new ExifRuleFire("R1", CodeConstants.CATEGORY_STARRY_SKY, R1_BOOST, created));
        logger.debug("EXIF ルール発火: rule=R1, category=213, boost=+{}", R1_BOOST);
    }

    private boolean conditionR1(ExifData exif) {
        return exif.exposureTimeSeconds().filter(t -> t >= R1_MIN_EXPOSURE_SECONDS).isPresent()
                && exif.iso().filter(i -> i >= R1_MIN_ISO).isPresent()
                && isNight(exif.dateTimeOriginal());
    }

    // ========== R2 夜景 ==========
    private void applyR2(List<Integer> codes, Map<String, Float> confidence,
                         ExifData exif, List<ExifRuleFire> fires) {
        // (a) と (b) の OR。両方成立しても 1 回だけ加算する。
        if (!conditionR2a(exif) && !conditionR2b(exif)) {
            return;
        }
        boolean created = boostOrAdd(codes, confidence,
                CodeConstants.CATEGORY_NIGHT_VIEW, R2_BOOST, true);
        fires.add(new ExifRuleFire("R2", CodeConstants.CATEGORY_NIGHT_VIEW, R2_BOOST, created));
        logger.debug("EXIF ルール発火: rule=R2, category=204, boost=+{}", R2_BOOST);
    }

    private boolean conditionR2a(ExifData exif) {
        return exif.exposureTimeSeconds().filter(t -> t >= R2A_MIN_EXPOSURE_SECONDS).isPresent()
                && exif.iso().filter(i -> i >= R2A_MIN_ISO).isPresent()
                && isNight(exif.dateTimeOriginal());
    }

    private boolean conditionR2b(ExifData exif) {
        return exif.iso().filter(i -> i >= R2B_MIN_ISO).isPresent()
                && isNight(exif.dateTimeOriginal());
    }

    // ========== R3 望遠 ==========
    private void applyR3(List<Integer> codes, Map<String, Float> confidence,
                         ExifData exif, List<ExifRuleFire> fires) {
        if (exif.focalLength35mm().filter(f -> f >= R3_MIN_FOCAL_35MM).isEmpty()) {
            return;
        }
        for (Integer target : R3_TARGET_CATEGORIES) {
            // 単独候補化 ❌: 既存候補のみブースト、新規追加は行わない
            if (!confidence.containsKey(String.valueOf(target))) {
                continue;
            }
            boostOrAdd(codes, confidence, target, R3_BOOST, false);
            fires.add(new ExifRuleFire("R3", target, R3_BOOST, false));
            logger.debug("EXIF ルール発火: rule=R3, category={}, boost=+{}", target, R3_BOOST);
        }
    }

    // ========== R3.5 焦点距離による野鳥/動物の振り分け（Issue#142、R4 を置換） ==========
    // 発火条件は「208(野鳥) が候補」のときだけ（= 鳥が検出された印）。207 単独では発火させない
    // （望遠で撮った犬等を野鳥へ誤分類しないため）。
    //   - 焦点距離 ≥300mm        : 野鳥(208) を加点する（除去はしない。混在写真の動物を消さないため）
    //   - 焦点距離 <300mm / 欠落 : 動物(207) を加点（未候補なら新規追加）し、野鳥(208) を候補から除去する
    private void applyR3_5(List<Integer> codes, Map<String, Float> confidence,
                           ExifData exif, List<ExifRuleFire> fires) {
        if (!confidence.containsKey(String.valueOf(CodeConstants.CATEGORY_WILD_BIRDS))) {
            return;
        }
        boolean isWild = exif.focalLength35mm().filter(f -> f >= R3_5_MIN_FOCAL_35MM).isPresent();

        if (isWild) {
            boostOrAdd(codes, confidence, CodeConstants.CATEGORY_WILD_BIRDS, R3_5_BOOST, false);
            fires.add(new ExifRuleFire("R3.5", CodeConstants.CATEGORY_WILD_BIRDS, R3_5_BOOST, false));
            logger.debug("EXIF ルール発火: rule=R3.5(野鳥), category=208, boost=+{}", R3_5_BOOST);
        } else {
            boolean created = boostOrAdd(codes, confidence, CodeConstants.CATEGORY_ANIMALS, R3_5_BOOST, true);
            removeCategory(codes, confidence, CodeConstants.CATEGORY_WILD_BIRDS);
            fires.add(new ExifRuleFire("R3.5", CodeConstants.CATEGORY_ANIMALS, R3_5_BOOST, created));
            logger.debug("EXIF ルール発火: rule=R3.5(動物), category=207 加点/追加 + 208 除去, boost=+{}", R3_5_BOOST);
        }
    }

    /** codes と confidence の両方からカテゴリを除去する（R3.5 の排他振り分け用に新設）。 */
    private void removeCategory(List<Integer> codes, Map<String, Float> confidence, int categoryCode) {
        codes.remove(Integer.valueOf(categoryCode));
        confidence.remove(String.valueOf(categoryCode));
    }

    // ========== R5 山岳 ==========
    private void applyR5(List<Integer> codes, Map<String, Float> confidence,
                         ExifData exif, List<ExifRuleFire> fires) {
        if (exif.gpsAltitude().filter(a -> a >= R5_MIN_ALTITUDE).isEmpty()) {
            return;
        }
        int target = CodeConstants.CATEGORY_NATURE;
        if (!confidence.containsKey(String.valueOf(target))) {
            return;
        }
        boostOrAdd(codes, confidence, target, R5_BOOST, false);
        fires.add(new ExifRuleFire("R5", target, R5_BOOST, false));
        logger.debug("EXIF ルール発火: rule=R5, category={}, boost=+{}", target, R5_BOOST);
    }

    // ========== 共通ヘルパー ==========

    /**
     * 既存候補があればブースト、無くて allowCreate=true なら新規追加（基準 70 + boost、上限 100）。
     * 戻り値: 新規追加した場合 true、既存ブーストの場合 false。
     */
    private boolean boostOrAdd(List<Integer> codes, Map<String, Float> confidence,
                               int categoryCode, int boostValue, boolean allowCreate) {
        String key = String.valueOf(categoryCode);
        if (confidence.containsKey(key)) {
            float updated = Math.min(confidence.get(key) + boostValue, MAX_CONFIDENCE);
            confidence.put(key, updated);
            return false;
        }
        if (allowCreate) {
            float newConf = Math.min(NEW_CANDIDATE_BASE_CONFIDENCE + boostValue, MAX_CONFIDENCE);
            confidence.put(key, newConf);
            if (!codes.contains(categoryCode)) {
                codes.add(categoryCode);
            }
            return true;
        }
        return false;
    }

    /** 「夜間」判定: 19:00:00 ≤ 時刻 OR 時刻 &lt; 05:00:00 */
    private boolean isNight(Optional<LocalDateTime> dateTime) {
        if (dateTime.isEmpty()) {
            return false;
        }
        LocalTime t = dateTime.get().toLocalTime();
        return !t.isBefore(NIGHT_START) || t.isBefore(NIGHT_END);
    }

    /**
     * Issue#132: EXIF 補正適用結果。補正後のマッピングと発火ルールのイベントを保持する。
     *
     * @param result      補正後のマッピング結果
     * @param rulesFired  発火したルールのイベント一覧（GA4 へ送信される）
     */
    public record Applied(LabelMappingResult result, List<ExifRuleFire> rulesFired) {
    }
}
