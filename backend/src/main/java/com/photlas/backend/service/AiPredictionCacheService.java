package com.photlas.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.CachedAnalyzeResult;
import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.entity.AiPredictionCache;
import com.photlas.backend.repository.AiPredictionCacheRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Issue#119 + Issue#136 §4.4: AI 予測結果の一時保管サービス。analyzeToken（UUID）の発行・取得・削除と
 * 期限切れトークンの定期クリーンアップを担当する。
 *
 * <p>フロントは analyzeToken のみ保持し、AI 結果本体はサーバーサイドの DB
 * （{@code ai_prediction_cache} テーブル）で保持する。これにより:</p>
 * <ul>
 *   <li>フロントエンドからの AI 結果改ざんを防げる</li>
 *   <li>EC2 を複数台に増やしても動く（複数 EC2 が同じ RDS を共有）</li>
 *   <li>追加インフラ不要（既存 RDS を使う）</li>
 * </ul>
 *
 * <p>Issue#136 Phase 10 (Q10/Q11) で {@link CachedAnalyzeResult} に拡張し、
 * 旧形式 ({@link LabelMappingResult} 単体 JSON) も {@code labelMapping} キーの
 * 有無で判別して読み込めるようにした。</p>
 */
@Service
public class AiPredictionCacheService {

    private static final Logger logger = LoggerFactory.getLogger(AiPredictionCacheService.class);

    /** Issue#119 4.4.1: AI 結果の保管期限（投稿フォーム滞在時間 + マージン）。 */
    private static final Duration TTL = Duration.ofMinutes(15);

    /** Issue#136 Q11: 新形式 JSON 判別用キー。 */
    private static final String NEW_FORMAT_KEY = "labelMapping";

    private final AiPredictionCacheRepository repository;
    private final ObjectMapper objectMapper;

    public AiPredictionCacheService(AiPredictionCacheRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    /**
     * Issue#136 Q10: AI 結果と AI 提案キーワードを一括保存し、analyzeToken を発行する。
     *
     * @param result マッピング結果 + 提案キーワード
     * @return analyzeToken。フロントが投稿時に送り返すことで AI 結果を取り出せる
     */
    @Transactional
    public String save(CachedAnalyzeResult result) {
        String token = UUID.randomUUID().toString();
        Date now = new Date();
        Date expiresAt = Date.from(now.toInstant().plus(TTL));
        repository.save(new AiPredictionCache(token, serialize(result), expiresAt, now));
        return token;
    }

    /**
     * Issue#136 Q10: トークンに対応する {@link CachedAnalyzeResult} を取得する。
     * 旧形式 JSON (labelMapping キーを含まない) は {@code suggestedTags=[]} で復元する (Q11)。
     *
     * @param analyzeToken {@link #save} で発行されたトークン
     * @return 有効なトークンに対応する解析結果、または空
     */
    @Transactional(readOnly = true)
    public Optional<CachedAnalyzeResult> findValid(String analyzeToken) {
        Date now = new Date();
        return repository.findById(analyzeToken)
                .filter(cache -> cache.getExpiresAt().after(now))
                .map(this::deserializeCompat);
    }

    /**
     * トークンを削除する（投稿確定時の使い切り削除）。存在しないトークンは無視する。
     *
     * @param analyzeToken 削除対象トークン
     */
    @Transactional
    public void delete(String analyzeToken) {
        if (repository.existsById(analyzeToken)) {
            repository.deleteById(analyzeToken);
        }
    }

    /**
     * 期限切れトークンを一括削除する。Spring Scheduled により毎日 03:00 に自動実行される。
     *
     * <p>cron は午前3時固定（投稿が少ない時間帯）。期限切れトークンが
     * 短時間残ること自体は害がないため日次実行で十分。</p>
     */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void cleanupExpired() {
        repository.deleteByExpiresAtBefore(new Date());
        logger.info("AI 予測結果キャッシュ: 期限切れトークンのクリーンアップを実行しました");
    }

    private String serialize(CachedAnalyzeResult result) {
        try {
            return objectMapper.writeValueAsString(result);
        } catch (JsonProcessingException e) {
            // CachedAnalyzeResult は単純な record で必ずシリアライズできるため、ここに到達するのは異常
            throw new IllegalStateException("AI 予測結果の JSON シリアライズに失敗しました", e);
        }
    }

    /**
     * Issue#136 Q11: フィールド有無による形式判定。例外を制御フローに使わない。
     */
    private CachedAnalyzeResult deserializeCompat(AiPredictionCache cache) {
        try {
            Map<String, Object> parsed = objectMapper.readValue(
                    cache.getAiResult(), new TypeReference<>() {});
            if (parsed.containsKey(NEW_FORMAT_KEY)) {
                return objectMapper.convertValue(parsed, CachedAnalyzeResult.class);
            }
            // 旧形式: LabelMappingResult 単体 → suggestedTags=[] で包んで返す
            LabelMappingResult legacy = objectMapper.convertValue(parsed, LabelMappingResult.class);
            return new CachedAnalyzeResult(legacy, List.of());
        } catch (JsonProcessingException e) {
            // DB に保存された JSON が壊れているのは異常事態
            throw new IllegalStateException(
                    "AI 予測結果の JSON 復元に失敗しました: token=" + cache.getAnalyzeToken(), e);
        }
    }
}
