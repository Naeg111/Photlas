package com.photlas.backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.entity.AiPredictionCache;
import com.photlas.backend.repository.AiPredictionCacheRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

/**
 * Issue#119: AI 予測結果の一時保管サービス。analyzeToken（UUID）の発行・取得・削除と
 * 期限切れトークンの定期クリーンアップを担当する。
 *
 * <p>フロントは analyzeToken のみ保持し、AI 結果本体はサーバーサイドの DB
 * （{@code ai_prediction_cache} テーブル）で保持する。これにより:</p>
 * <ul>
 *   <li>フロントエンドからの AI 結果改ざんを防げる</li>
 *   <li>EC2 を複数台に増やしても動く（複数 EC2 が同じ RDS を共有）</li>
 *   <li>追加インフラ不要（既存 RDS を使う）</li>
 * </ul>
 */
@Service
public class AiPredictionCacheService {

    private static final Logger logger = LoggerFactory.getLogger(AiPredictionCacheService.class);

    /** Issue#119 4.4.1: AI 結果の保管期限（投稿フォーム滞在時間 + マージン）。 */
    private static final Duration TTL = Duration.ofMinutes(15);

    private final AiPredictionCacheRepository repository;
    private final ObjectMapper objectMapper;

    public AiPredictionCacheService(AiPredictionCacheRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    /**
     * AI 結果を一時保管し、analyzeToken（UUID v4 文字列）を発行する。
     *
     * @param result Rekognition の解析結果
     * @return analyzeToken。フロントが投稿時に送り返すことで AI 結果を取り出せる
     */
    @Transactional
    public String save(LabelMappingResult result) {
        String token = UUID.randomUUID().toString();
        Date now = new Date();
        Date expiresAt = Date.from(now.toInstant().plus(TTL));
        try {
            String json = objectMapper.writeValueAsString(result);
            repository.save(new AiPredictionCache(token, json, expiresAt, now));
            return token;
        } catch (JsonProcessingException e) {
            // LabelMappingResult は単純な record で必ずシリアライズできるため、ここに到達するのは異常
            throw new IllegalStateException("AI 予測結果の JSON シリアライズに失敗しました", e);
        }
    }

    /**
     * トークンに対応する AI 結果を取得する。期限切れ・存在しない場合は空。
     *
     * @param analyzeToken save() で発行されたトークン
     * @return 有効なトークンに対応する AI 結果、または空
     */
    @Transactional(readOnly = true)
    public Optional<LabelMappingResult> findValid(String analyzeToken) {
        Date now = new Date();
        return repository.findById(analyzeToken)
                .filter(cache -> cache.getExpiresAt().after(now))
                .map(this::deserialize);
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
     *
     * @return 削除した行数（参考値、現状は常に 0 を返す。Spring Data の派生クエリは件数を返さないため）
     */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public int cleanupExpired() {
        repository.deleteByExpiresAtBefore(new Date());
        logger.info("AI 予測結果キャッシュ: 期限切れトークンのクリーンアップを実行しました");
        return 0;
    }

    private LabelMappingResult deserialize(AiPredictionCache cache) {
        try {
            return objectMapper.readValue(cache.getAiResult(), LabelMappingResult.class);
        } catch (JsonProcessingException e) {
            // DB に保存された JSON が壊れているのは異常事態
            throw new IllegalStateException(
                    "AI 予測結果の JSON 復元に失敗しました: token=" + cache.getAnalyzeToken(), e);
        }
    }
}
