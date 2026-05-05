package com.photlas.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.Temporal;
import jakarta.persistence.TemporalType;
import jakarta.validation.constraints.NotNull;

import java.util.Date;
import java.util.Objects;

/**
 * Issue#119: AI 解析結果の一時保管エンティティ。
 *
 * <p>{@code POST /api/v1/photos/analyze} で得た AI 結果を、後の正式投稿
 * （{@code POST /api/v1/photos}）まで一時保管する。フロントは analyzeToken（UUID）のみ持ち、
 * AI 結果本体は持たない（改ざん防止）。</p>
 *
 * <p>TTL は 15 分。期限切れトークンは {@code AiPredictionCacheService.cleanupExpired()}
 * が日次で削除する。</p>
 */
@Entity
@Table(name = "ai_prediction_cache")
public class AiPredictionCache {

    @Id
    @Column(name = "analyze_token", length = 36)
    private String analyzeToken;

    /**
     * AI 結果 JSON（{@link com.photlas.backend.dto.LabelMappingResult} を Jackson で
     * シリアライズした文字列）。{@code @Lob} により H2 では CLOB、PostgreSQL では TEXT 列に対応。
     */
    @Lob
    @Column(name = "ai_result", nullable = false)
    @NotNull
    private String aiResult;

    @Column(name = "expires_at", nullable = false)
    @NotNull
    @Temporal(TemporalType.TIMESTAMP)
    private Date expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    @NotNull
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    public AiPredictionCache() {
    }

    public AiPredictionCache(String analyzeToken, String aiResult, Date expiresAt, Date createdAt) {
        this.analyzeToken = analyzeToken;
        this.aiResult = aiResult;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    public String getAnalyzeToken() {
        return analyzeToken;
    }

    public void setAnalyzeToken(String analyzeToken) {
        this.analyzeToken = analyzeToken;
    }

    public String getAiResult() {
        return aiResult;
    }

    public void setAiResult(String aiResult) {
        this.aiResult = aiResult;
    }

    public Date getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Date expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof AiPredictionCache that)) return false;
        return Objects.equals(analyzeToken, that.analyzeToken);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(analyzeToken);
    }
}
