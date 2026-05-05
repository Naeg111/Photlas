package com.photlas.backend.service;

import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.entity.AiPredictionCache;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.repository.AiPredictionCacheRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#119 - {@link AiPredictionCacheService} の統合テスト。
 *
 * <p>UUID 発行、TTL 15分、期限切れの除外、使い切り削除、定期クリーンアップ、
 * Jackson による JSON ラウンドトリップを検証する。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AiPredictionCacheServiceTest {

    @Autowired
    private AiPredictionCacheService service;

    @Autowired
    private AiPredictionCacheRepository repository;

    private LabelMappingResult sampleResult() {
        return new LabelMappingResult(
                List.of(CodeConstants.CATEGORY_NATURE, CodeConstants.CATEGORY_NIGHT_VIEW),
                CodeConstants.WEATHER_SUNNY,
                Map.of(
                        String.valueOf(CodeConstants.CATEGORY_NATURE), 92.5f,
                        String.valueOf(CodeConstants.CATEGORY_NIGHT_VIEW), 78.0f,
                        String.valueOf(CodeConstants.WEATHER_SUNNY), 85.0f
                )
        );
    }

    // ========== save ==========

    @Test
    @DisplayName("Issue#119 - save: 非 null の UUID 文字列を返す")
    void saveReturnsNonNullUuidToken() {
        String token = service.save(sampleResult());

        assertThat(token).isNotNull();
        assertThat(token).hasSize(36); // UUID v4 文字列
        UUID.fromString(token); // 例外が出なければ妥当な UUID
    }

    @Test
    @DisplayName("Issue#119 - save: 各回ユニークなトークンを返す")
    void saveReturnsUniqueTokens() {
        String token1 = service.save(sampleResult());
        String token2 = service.save(sampleResult());

        assertThat(token1).isNotEqualTo(token2);
    }

    @Test
    @DisplayName("Issue#119 - save: ai_prediction_cache テーブルにエントリを永続化する")
    void savePersistsEntry() {
        String token = service.save(sampleResult());

        Optional<AiPredictionCache> entity = repository.findById(token);
        assertThat(entity).isPresent();
        assertThat(entity.get().getAiResult()).isNotBlank();
    }

    @Test
    @DisplayName("Issue#119 - save: expires_at を現在時刻 + 15分の前後に設定する")
    void saveSetsExpiresAtFifteenMinutesAhead() {
        Date before = new Date();
        String token = service.save(sampleResult());
        Date after = new Date();

        AiPredictionCache entity = repository.findById(token).orElseThrow();
        Date expiresAt = entity.getExpiresAt();

        Date expectedMin = Date.from(before.toInstant().plus(Duration.ofMinutes(15)).minusSeconds(5));
        Date expectedMax = Date.from(after.toInstant().plus(Duration.ofMinutes(15)).plusSeconds(5));

        assertThat(expiresAt).isAfterOrEqualTo(expectedMin).isBeforeOrEqualTo(expectedMax);
    }

    // ========== findValid ==========

    @Test
    @DisplayName("Issue#119 - findValid: 有効なトークンに対して保存した結果を返す")
    void findValidReturnsResultForValidToken() {
        LabelMappingResult original = sampleResult();
        String token = service.save(original);

        Optional<LabelMappingResult> found = service.findValid(token);

        assertThat(found).isPresent();
        assertThat(found.get().categories())
                .containsExactlyInAnyOrderElementsOf(original.categories());
        assertThat(found.get().weather()).isEqualTo(original.weather());
        assertThat(found.get().confidence()).isEqualTo(original.confidence());
    }

    @Test
    @DisplayName("Issue#119 - findValid: 存在しないトークンに対して空を返す")
    void findValidReturnsEmptyForUnknownToken() {
        Optional<LabelMappingResult> found = service.findValid(UUID.randomUUID().toString());

        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("Issue#119 - findValid: 期限切れトークンに対して空を返す")
    void findValidReturnsEmptyForExpiredToken() {
        // 期限切れエントリを直接 repository に保存
        String expiredToken = UUID.randomUUID().toString();
        Date past = Date.from(Instant.now().minus(Duration.ofMinutes(1)));
        AiPredictionCache expired = new AiPredictionCache(
                expiredToken,
                "{\"categories\":[],\"weather\":null,\"confidence\":{}}",
                past,
                new Date()
        );
        repository.save(expired);

        Optional<LabelMappingResult> found = service.findValid(expiredToken);

        assertThat(found).isEmpty();
    }

    // ========== delete ==========

    @Test
    @DisplayName("Issue#119 - delete: 指定トークンのエントリを削除する")
    void deleteRemovesEntry() {
        String token = service.save(sampleResult());
        assertThat(repository.findById(token)).isPresent();

        service.delete(token);

        assertThat(repository.findById(token)).isEmpty();
    }

    @Test
    @DisplayName("Issue#119 - delete: 存在しないトークンを指定しても例外を投げない")
    void deleteIgnoresUnknownToken() {
        // 例外が出なければ OK
        service.delete(UUID.randomUUID().toString());
    }

    // ========== cleanupExpired ==========

    @Test
    @DisplayName("Issue#119 - cleanupExpired: 期限切れエントリだけを削除し、有効なものは残す")
    void cleanupExpiredRemovesOnlyExpiredEntries() {
        // 有効: now + 15min（save() 経由）
        String validToken = service.save(sampleResult());

        // 期限切れ: now - 1min（直接 repository）
        String expiredToken = UUID.randomUUID().toString();
        Date past = Date.from(Instant.now().minus(Duration.ofMinutes(1)));
        repository.save(new AiPredictionCache(
                expiredToken,
                "{\"categories\":[],\"weather\":null,\"confidence\":{}}",
                past,
                new Date()
        ));

        service.cleanupExpired();

        assertThat(repository.findById(validToken)).isPresent();
        assertThat(repository.findById(expiredToken)).isEmpty();
    }

    @Test
    @DisplayName("Issue#119 - cleanupExpired: 期限切れがない場合は何もしない（例外も出さない）")
    void cleanupExpiredHandlesEmptyState() {
        service.save(sampleResult()); // 有効なエントリのみ

        service.cleanupExpired(); // 例外が出ないこと
    }

    // ========== JSON ラウンドトリップ ==========

    @Test
    @DisplayName("Issue#119 - JSON ラウンドトリップ: weather=null と空 confidence でも壊れない")
    void roundTripHandlesNullWeatherAndEmptyConfidence() {
        LabelMappingResult original = new LabelMappingResult(List.of(), null, Map.of());
        String token = service.save(original);

        Optional<LabelMappingResult> found = service.findValid(token);

        assertThat(found).isPresent();
        assertThat(found.get().categories()).isEmpty();
        assertThat(found.get().weather()).isNull();
        assertThat(found.get().confidence()).isEmpty();
    }

    @Test
    @DisplayName("Issue#119 - JSON ラウンドトリップ: confidence の Float 値が精度劣化なく復元される")
    void roundTripPreservesFloatPrecision() {
        LabelMappingResult original = new LabelMappingResult(
                List.of(CodeConstants.CATEGORY_NATURE),
                null,
                Map.of(String.valueOf(CodeConstants.CATEGORY_NATURE), 92.5f)
        );
        String token = service.save(original);

        Optional<LabelMappingResult> found = service.findValid(token);

        assertThat(found).isPresent();
        assertThat(found.get().confidence().get(String.valueOf(CodeConstants.CATEGORY_NATURE)))
                .isEqualTo(92.5f);
    }
}
