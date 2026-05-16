package com.photlas.backend.service;

import com.photlas.backend.dto.ExifData;
import com.photlas.backend.dto.ExifRuleFire;
import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.entity.CodeConstants;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.offset;

/**
 * Issue#132 - {@link ExifBasedCategoryHints} の単体テスト。
 *
 * <p>EXIF 撮影情報に基づくスコア補正 R1〜R5 のロジックを検証する。
 * Spring を起動せず、純粋なロジックとして高速に実行する。</p>
 */
class ExifBasedCategoryHintsTest {

    private ExifBasedCategoryHints hints;

    @BeforeEach
    void setUp() {
        hints = new ExifBasedCategoryHints();
    }

    /** カテゴリコード conf% で 1 候補のみ持つ LabelMappingResult を作るヘルパー。 */
    private LabelMappingResult singleCategory(int code, float conf) {
        Map<String, Float> confidence = new LinkedHashMap<>();
        confidence.put(String.valueOf(code), conf);
        return new LabelMappingResult(new ArrayList<>(List.of(code)), null, confidence);
    }

    /** カテゴリ候補なしの空 LabelMappingResult。 */
    private LabelMappingResult empty() {
        return new LabelMappingResult(new ArrayList<>(), null, new LinkedHashMap<>());
    }

    /** EXIF: 露光15秒/ISO1600/22:00 の星空シナリオ。 */
    private ExifData starryNightExif() {
        return ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 22, 0))
                .exposureTimeSeconds(15.0)
                .iso(1600)
                .build();
    }

    // ========== R1: 星空判定 ==========

    @Test
    @DisplayName("Issue#132 R1 - 既存 213 候補にブースト +30 が加算される")
    void r1BoostsExistingStarrySkyCandidate() {
        LabelMappingResult base = singleCategory(CodeConstants.CATEGORY_STARRY_SKY, 50f);

        ExifBasedCategoryHints.Applied applied = hints.apply(base, starryNightExif());

        Float conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_STARRY_SKY));
        assertThat(conf).isCloseTo(80.0f, offset(0.01f)); // 50 + 30
        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule, ExifRuleFire::categoryCode,
                        ExifRuleFire::boostValue, ExifRuleFire::createdNewCandidate)
                .contains(tuple("R1", CodeConstants.CATEGORY_STARRY_SKY, 30, false));
    }

    @Test
    @DisplayName("Issue#132 R1 - Rekognition 未検出でも新規候補として 213 を追加する（単独候補化 ✅）")
    void r1CreatesNewStarrySkyCandidate() {
        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), starryNightExif());

        assertThat(applied.result().categories()).contains(CodeConstants.CATEGORY_STARRY_SKY);
        Float conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_STARRY_SKY));
        assertThat(conf).isCloseTo(100.0f, offset(0.01f)); // 70 + 30
        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule, ExifRuleFire::categoryCode,
                        ExifRuleFire::boostValue, ExifRuleFire::createdNewCandidate)
                .contains(tuple("R1", CodeConstants.CATEGORY_STARRY_SKY, 30, true));
    }

    @Test
    @DisplayName("Issue#132 R1 - 信頼度の上限は 100")
    void r1CapsConfidenceAt100() {
        LabelMappingResult base = singleCategory(CodeConstants.CATEGORY_STARRY_SKY, 95f);

        ExifBasedCategoryHints.Applied applied = hints.apply(base, starryNightExif());

        Float conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_STARRY_SKY));
        assertThat(conf).isCloseTo(100.0f, offset(0.01f)); // 95 + 30 = 125 → 100
    }

    @Test
    @DisplayName("Issue#132 R1 境界 - 露光 10秒/ISO 800/19:00:00 ちょうどは発火")
    void r1FiresAtLowerBoundary() {
        ExifData exif = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 19, 0, 0))
                .exposureTimeSeconds(10.0)
                .iso(800)
                .build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule)
                .contains("R1");
    }

    @Test
    @DisplayName("Issue#132 R1 境界 - 露光 9.99秒では発火しない")
    void r1DoesNotFireWhenExposureBelowThreshold() {
        ExifData exif = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 22, 0))
                .exposureTimeSeconds(9.99)
                .iso(1600)
                .build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule)
                .doesNotContain("R1");
    }

    @Test
    @DisplayName("Issue#132 R1 境界 - ISO 799 では発火しない")
    void r1DoesNotFireWhenIsoBelowThreshold() {
        ExifData exif = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 22, 0))
                .exposureTimeSeconds(15.0)
                .iso(799)
                .build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule)
                .doesNotContain("R1");
    }

    @Test
    @DisplayName("Issue#132 R1 境界 - 時刻 18:59:59 は範囲外で発火しない")
    void r1DoesNotFireAt1859_59() {
        ExifData exif = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 18, 59, 59))
                .exposureTimeSeconds(15.0)
                .iso(1600)
                .build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule)
                .doesNotContain("R1");
    }

    @Test
    @DisplayName("Issue#132 R1 境界 - 時刻 04:59:59 は範囲内で発火する")
    void r1FiresAt0459_59() {
        ExifData exif = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 4, 59, 59))
                .exposureTimeSeconds(15.0)
                .iso(1600)
                .build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule)
                .contains("R1");
    }

    @Test
    @DisplayName("Issue#132 R1 境界 - 時刻 05:00:00 ちょうどは範囲外で発火しない")
    void r1DoesNotFireAt0500() {
        ExifData exif = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 5, 0, 0))
                .exposureTimeSeconds(15.0)
                .iso(1600)
                .build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule)
                .doesNotContain("R1");
    }

    @Test
    @DisplayName("Issue#132 R1 - EXIF タグ欠損時は発火しない（ルールスキップ）")
    void r1SkippedWhenAnyTagMissing() {
        ExifData missingExposure = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 22, 0))
                .iso(1600)
                .build();
        ExifData missingIso = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 22, 0))
                .exposureTimeSeconds(15.0)
                .build();
        ExifData missingTime = ExifData.builder()
                .exposureTimeSeconds(15.0)
                .iso(1600)
                .build();

        for (ExifData exif : List.of(missingExposure, missingIso, missingTime)) {
            ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);
            assertThat(applied.rulesFired())
                    .extracting(ExifRuleFire::rule)
                    .doesNotContain("R1");
        }
    }

    // ========== R2: 夜景判定 ==========

    @Test
    @DisplayName("Issue#132 R2(a) - 露光 5秒以上 + ISO 800以上 + 夜間 で 204 に +20")
    void r2aFiresAndAddsNewNightViewCandidate() {
        ExifData exif = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 22, 0))
                .exposureTimeSeconds(5.0)
                .iso(800)
                .build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        assertThat(applied.result().categories()).contains(CodeConstants.CATEGORY_NIGHT_VIEW);
        Float conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_NIGHT_VIEW));
        assertThat(conf).isCloseTo(90.0f, offset(0.01f)); // 70 + 20
        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule, ExifRuleFire::categoryCode,
                        ExifRuleFire::boostValue, ExifRuleFire::createdNewCandidate)
                .contains(tuple("R2", CodeConstants.CATEGORY_NIGHT_VIEW, 20, true));
    }

    @Test
    @DisplayName("Issue#132 R2(b) - ISO 2400以上 + 夜間 だけで 204 に +20 が発火")
    void r2bFiresFromHighIsoOnly() {
        ExifData exif = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 22, 0))
                .exposureTimeSeconds(0.5) // 短い露光
                .iso(2400)
                .build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule, ExifRuleFire::boostValue)
                .contains(tuple("R2", 20));
    }

    @Test
    @DisplayName("Issue#132 R2 - (a)(b) が両方成立しても +20 を二重加算しない")
    void r2DoesNotDoubleCountWhenBothConditionsMet() {
        ExifData exif = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 22, 0))
                .exposureTimeSeconds(5.0)
                .iso(3200) // (a) も (b) も成立
                .build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        Float conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_NIGHT_VIEW));
        assertThat(conf).isCloseTo(90.0f, offset(0.01f)); // 70 + 20（+40 ではない）
        long r2Count = applied.rulesFired().stream()
                .filter(r -> "R2".equals(r.rule()))
                .count();
        assertThat(r2Count).isEqualTo(1);
    }

    @Test
    @DisplayName("Issue#132 R2 - 昼間 + 低 ISO は発火しない")
    void r2DoesNotFireInDayLightWithLowIso() {
        ExifData exif = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 13, 0))
                .exposureTimeSeconds(0.002)
                .iso(200)
                .build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule)
                .doesNotContain("R2");
    }

    // ========== R1 + R2 同時発火 ==========

    @Test
    @DisplayName("Issue#132 - R1 + R2(a) 同時発火: 星空 +30 と 夜景 +20 が両方加算される")
    void r1AndR2aBothFire() {
        // 露光 15秒 (R1: ≥10, R2(a): ≥5) + ISO 1600 (≥800) + 22:00 (夜)
        ExifData exif = starryNightExif();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        assertThat(applied.result().categories())
                .contains(CodeConstants.CATEGORY_STARRY_SKY, CodeConstants.CATEGORY_NIGHT_VIEW);
        Float r1Conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_STARRY_SKY));
        Float r2Conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_NIGHT_VIEW));
        assertThat(r1Conf).isCloseTo(100.0f, offset(0.01f)); // 70 + 30
        assertThat(r2Conf).isCloseTo(90.0f, offset(0.01f));  // 70 + 20
        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule)
                .contains("R1", "R2");
    }

    // ========== R3: 望遠ヒント ==========

    @Test
    @DisplayName("Issue#132 R3 - 焦点距離 200mm 以上で 207/208/211/212 検出済み候補に +10 ブースト")
    void r3BoostsExistingTelephotoCandidates() {
        // 207 だけ検出済み
        LabelMappingResult base = singleCategory(CodeConstants.CATEGORY_ANIMALS, 60f);
        ExifData exif = ExifData.builder().focalLength35mm(200).build();

        ExifBasedCategoryHints.Applied applied = hints.apply(base, exif);

        Float conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_ANIMALS));
        assertThat(conf).isCloseTo(70.0f, offset(0.01f));
        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule, ExifRuleFire::categoryCode,
                        ExifRuleFire::boostValue, ExifRuleFire::createdNewCandidate)
                .contains(tuple("R3", CodeConstants.CATEGORY_ANIMALS, 10, false));
    }

    @Test
    @DisplayName("Issue#132 R3 - Rekognition 未検出カテゴリには候補を追加しない（単独候補化 ❌）")
    void r3DoesNotCreateNewCandidatesWhenNotDetected() {
        ExifData exif = ExifData.builder().focalLength35mm(300).build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        // 207/208/211/212 のいずれもカテゴリ候補に追加されない
        assertThat(applied.result().categories()).isEmpty();
        // R3 はルール発火していない (作用対象が無いため発火イベントも出ない)
        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule)
                .doesNotContain("R3");
    }

    @Test
    @DisplayName("Issue#132 R3 境界 - 焦点距離 199mm では発火しない")
    void r3DoesNotFireBelow200mm() {
        LabelMappingResult base = singleCategory(CodeConstants.CATEGORY_ANIMALS, 60f);
        ExifData exif = ExifData.builder().focalLength35mm(199).build();

        ExifBasedCategoryHints.Applied applied = hints.apply(base, exif);

        Float conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_ANIMALS));
        assertThat(conf).isCloseTo(60.0f, offset(0.01f));
    }

    // ========== R4: 超望遠ヒント ==========

    @Test
    @DisplayName("Issue#132 R4 - 焦点距離 400mm 以上で 208 検出済み候補に +20 ブースト")
    void r4BoostsExistingWildBirdCandidate() {
        LabelMappingResult base = singleCategory(CodeConstants.CATEGORY_WILD_BIRDS, 50f);
        ExifData exif = ExifData.builder().focalLength35mm(400).build();

        ExifBasedCategoryHints.Applied applied = hints.apply(base, exif);

        Float conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_WILD_BIRDS));
        // R3 +10 + R4 +20 = +30 → 50 + 30 = 80
        assertThat(conf).isCloseTo(80.0f, offset(0.01f));
        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule, ExifRuleFire::categoryCode, ExifRuleFire::boostValue)
                .contains(
                        tuple("R3", CodeConstants.CATEGORY_WILD_BIRDS, 10),
                        tuple("R4", CodeConstants.CATEGORY_WILD_BIRDS, 20)
                );
    }

    @Test
    @DisplayName("Issue#132 R4 - 208 が未検出なら何も追加しない")
    void r4DoesNotCreateNewCandidatesWhenNotDetected() {
        ExifData exif = ExifData.builder().focalLength35mm(500).build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        assertThat(applied.result().categories()).isEmpty();
    }

    // ========== R5: 山岳ヒント ==========

    @Test
    @DisplayName("Issue#132 R5 - GPS 標高 1000m 以上で 201 検出済み候補に +10 ブースト")
    void r5BoostsExistingNatureCandidate() {
        LabelMappingResult base = singleCategory(CodeConstants.CATEGORY_NATURE, 60f);
        ExifData exif = ExifData.builder().gpsAltitude(1500.0).build();

        ExifBasedCategoryHints.Applied applied = hints.apply(base, exif);

        Float conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_NATURE));
        assertThat(conf).isCloseTo(70.0f, offset(0.01f));
        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule, ExifRuleFire::categoryCode, ExifRuleFire::boostValue,
                        ExifRuleFire::createdNewCandidate)
                .contains(tuple("R5", CodeConstants.CATEGORY_NATURE, 10, false));
    }

    @Test
    @DisplayName("Issue#132 R5 - 201 が未検出なら何も追加しない（単独候補化 ❌）")
    void r5DoesNotCreateNewCandidatesWhenNotDetected() {
        ExifData exif = ExifData.builder().gpsAltitude(2500.0).build();

        ExifBasedCategoryHints.Applied applied = hints.apply(empty(), exif);

        assertThat(applied.result().categories()).isEmpty();
        assertThat(applied.rulesFired())
                .extracting(ExifRuleFire::rule)
                .doesNotContain("R5");
    }

    @Test
    @DisplayName("Issue#132 R5 境界 - 標高 999m では発火しない")
    void r5DoesNotFireBelow1000m() {
        LabelMappingResult base = singleCategory(CodeConstants.CATEGORY_NATURE, 60f);
        ExifData exif = ExifData.builder().gpsAltitude(999.0).build();

        ExifBasedCategoryHints.Applied applied = hints.apply(base, exif);

        Float conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_NATURE));
        assertThat(conf).isCloseTo(60.0f, offset(0.01f));
    }

    // ========== EXIF 空 ==========

    @Test
    @DisplayName("Issue#132 - ExifData.empty() の場合は何のルールも発火しない")
    void noRulesFireWhenExifIsEmpty() {
        LabelMappingResult base = singleCategory(CodeConstants.CATEGORY_NATURE, 60f);

        ExifBasedCategoryHints.Applied applied = hints.apply(base, ExifData.empty());

        assertThat(applied.rulesFired()).isEmpty();
        // 元の結果はそのまま
        assertThat(applied.result().categories()).containsExactly(CodeConstants.CATEGORY_NATURE);
        Float conf = applied.result().confidence().get(String.valueOf(CodeConstants.CATEGORY_NATURE));
        assertThat(conf).isCloseTo(60.0f, offset(0.01f));
    }

    // ========== Util ==========

    private static org.assertj.core.groups.Tuple tuple(Object... values) {
        return org.assertj.core.groups.Tuple.tuple(values);
    }
}
