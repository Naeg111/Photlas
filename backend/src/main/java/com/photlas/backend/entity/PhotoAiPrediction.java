package com.photlas.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

/**
 * Issue#119: AI 画像認識の予測結果を保存するエンティティ。
 *
 * <p>{@link Photo} とは1対多の関係（同一写真に対し複数モデルの予測を保持可能、
 * 現状は Rekognition のみ）。{@code ON DELETE CASCADE} により写真削除時に
 * 連動削除される（GDPR 等のデータ削除要請対応）。</p>
 *
 * <p>{@code predictedCategories} と {@code confidence} は JSON 文字列として TEXT に保存。
 * 案1（String + Jackson、アプリ層 serialize）。将来 JSONB 化検討中
 * （Issue#119 8. 未決事項、Issue#120 解決後）。</p>
 */
@Entity
@Table(name = "photo_ai_predictions")
public class PhotoAiPrediction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "photo_id", nullable = false)
    @NotNull
    private Long photoId;

    @Column(name = "model_name", nullable = false, length = 50)
    @NotBlank
    private String modelName;

    @Column(name = "model_version", length = 20)
    private String modelVersion;

    /** AI 判定カテゴリ ID 配列を JSON シリアライズした文字列（例: "[201, 204]"）。 */
    @Column(name = "predicted_categories", nullable = false, columnDefinition = "TEXT")
    @NotNull
    private String predictedCategories;

    /** AI 判定天候コード（400番台 INTEGER）。判定不可なら NULL。 */
    @Column(name = "predicted_weather")
    private Integer predictedWeather;

    /** 各カテゴリ/天候の信頼度マップを JSON シリアライズした文字列（例: '{"201": 92.5}'）。 */
    @Column(name = "confidence", nullable = false, columnDefinition = "TEXT")
    @NotNull
    private String confidence;

    /** ユーザー選択カテゴリと AI 予測カテゴリの重複ゼロなら TRUE（運営の事後確認対象）。 */
    @Column(name = "user_diff_flag", nullable = false)
    private boolean userDiffFlag;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public PhotoAiPrediction() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getPhotoId() {
        return photoId;
    }

    public void setPhotoId(Long photoId) {
        this.photoId = photoId;
    }

    public String getModelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public void setModelVersion(String modelVersion) {
        this.modelVersion = modelVersion;
    }

    public String getPredictedCategories() {
        return predictedCategories;
    }

    public void setPredictedCategories(String predictedCategories) {
        this.predictedCategories = predictedCategories;
    }

    public Integer getPredictedWeather() {
        return predictedWeather;
    }

    public void setPredictedWeather(Integer predictedWeather) {
        this.predictedWeather = predictedWeather;
    }

    public String getConfidence() {
        return confidence;
    }

    public void setConfidence(String confidence) {
        this.confidence = confidence;
    }

    public boolean isUserDiffFlag() {
        return userDiffFlag;
    }

    public void setUserDiffFlag(boolean userDiffFlag) {
        this.userDiffFlag = userDiffFlag;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
