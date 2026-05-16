package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * 写真投稿リクエストDTO
 * 写真の投稿に必要な情報を格納します。
 */
public class CreatePhotoRequest {

    @Size(max = 100, message = "施設名・店名は100文字以内で入力してください")
    private String placeName;

    @NotBlank(message = "S3オブジェクトキーは必須です")
    @Pattern(regexp = "^(uploads|profile-images)/\\d+/[a-f0-9\\-]+\\.(jpg|jpeg|png|webp|heic)$",
            message = "S3オブジェクトキーの形式が不正です")
    private String s3ObjectKey;

    @NotBlank(message = "撮影日時は必須です")
    private String takenAt;

    @NotNull(message = "緯度は必須です")
    @DecimalMin(value = "-90.0", message = "緯度は-90以上である必要があります")
    @DecimalMax(value = "90.0", message = "緯度は90以下である必要があります")
    private BigDecimal latitude;

    @NotNull(message = "経度は必須です")
    @DecimalMin(value = "-180.0", message = "経度は-180以上である必要があります")
    @DecimalMax(value = "180.0", message = "経度は180以下である必要があります")
    private BigDecimal longitude;

    private List<String> categories;

    private Integer weather;

    private Integer deviceType;

    private String cameraBody;

    private String cameraLens;

    @JsonProperty("focalLength35mm")
    private Integer focalLength35mm;

    @JsonProperty("fValue")
    private String fValue;

    private String shutterSpeed;

    private Integer iso;

    private Integer imageWidth;

    private Integer imageHeight;

    private Double cropCenterX;

    private Double cropCenterY;

    private Double cropZoom;

    /**
     * Issue#119: AI 解析で発行された analyzeToken（任意）。
     * フロントが {@code POST /api/v1/photos/analyze} で受け取り、投稿時にそのまま送信する。
     * 本フィールドが設定されている場合、バックエンドは {@code ai_prediction_cache} から
     * AI 結果を取り出して {@code photo_ai_predictions} に保存する。
     */
    private String analyzeToken;

    /**
     * Issue#135: ユーザーが投稿時に選んだ全キーワードの tag_id 一覧（任意）。
     * AI 提案を残したもの + 手動追加したもの両方を含む。null/空は「キーワードなし投稿」扱い。
     */
    private List<Long> tagIds;

    /**
     * Issue#135: 上記 {@code tagIds} のうち、元々 AI 提案だったタグの subset。
     * ここに含まれる tag_id は {@code photo_tags.assigned_by='AI'} で保存される。
     * それ以外の tag_id は {@code assigned_by='USER'} 扱い。
     */
    private List<Long> aiOriginatedTagIds;

    // Getters and Setters
    public String getPlaceName() {
        return placeName;
    }

    public void setPlaceName(String placeName) {
        this.placeName = placeName;
    }

    public String getS3ObjectKey() {
        return s3ObjectKey;
    }

    public void setS3ObjectKey(String s3ObjectKey) {
        this.s3ObjectKey = s3ObjectKey;
    }

    public String getTakenAt() {
        return takenAt;
    }

    public void setTakenAt(String takenAt) {
        this.takenAt = takenAt;
    }

    public BigDecimal getLatitude() {
        return latitude;
    }

    public void setLatitude(BigDecimal latitude) {
        this.latitude = latitude;
    }

    public BigDecimal getLongitude() {
        return longitude;
    }

    public void setLongitude(BigDecimal longitude) {
        this.longitude = longitude;
    }

    public List<String> getCategories() {
        return categories;
    }

    public void setCategories(List<String> categories) {
        this.categories = categories;
    }

    public Integer getWeather() {
        return weather;
    }

    public void setWeather(Integer weather) {
        this.weather = weather;
    }

    public Integer getDeviceType() {
        return deviceType;
    }

    public void setDeviceType(Integer deviceType) {
        this.deviceType = deviceType;
    }

    public String getCameraBody() {
        return cameraBody;
    }

    public void setCameraBody(String cameraBody) {
        this.cameraBody = cameraBody;
    }

    public String getCameraLens() {
        return cameraLens;
    }

    public void setCameraLens(String cameraLens) {
        this.cameraLens = cameraLens;
    }

    public Integer getFocalLength35mm() {
        return focalLength35mm;
    }

    public void setFocalLength35mm(Integer focalLength35mm) {
        this.focalLength35mm = focalLength35mm;
    }

    public String getFValue() {
        return fValue;
    }

    public void setFValue(String fValue) {
        this.fValue = fValue;
    }

    public String getShutterSpeed() {
        return shutterSpeed;
    }

    public void setShutterSpeed(String shutterSpeed) {
        this.shutterSpeed = shutterSpeed;
    }

    public Integer getIso() {
        return iso;
    }

    public void setIso(Integer iso) {
        this.iso = iso;
    }

    public Integer getImageWidth() {
        return imageWidth;
    }

    public void setImageWidth(Integer imageWidth) {
        this.imageWidth = imageWidth;
    }

    public Integer getImageHeight() {
        return imageHeight;
    }

    public void setImageHeight(Integer imageHeight) {
        this.imageHeight = imageHeight;
    }

    public Double getCropCenterX() {
        return cropCenterX;
    }

    public void setCropCenterX(Double cropCenterX) {
        this.cropCenterX = cropCenterX;
    }

    public Double getCropCenterY() {
        return cropCenterY;
    }

    public void setCropCenterY(Double cropCenterY) {
        this.cropCenterY = cropCenterY;
    }

    public Double getCropZoom() {
        return cropZoom;
    }

    public void setCropZoom(Double cropZoom) {
        this.cropZoom = cropZoom;
    }

    public String getAnalyzeToken() {
        return analyzeToken;
    }

    public void setAnalyzeToken(String analyzeToken) {
        this.analyzeToken = analyzeToken;
    }

    public List<Long> getTagIds() {
        return tagIds;
    }

    public void setTagIds(List<Long> tagIds) {
        this.tagIds = tagIds;
    }

    public List<Long> getAiOriginatedTagIds() {
        return aiOriginatedTagIds;
    }

    public void setAiOriginatedTagIds(List<Long> aiOriginatedTagIds) {
        this.aiOriginatedTagIds = aiOriginatedTagIds;
    }
}
