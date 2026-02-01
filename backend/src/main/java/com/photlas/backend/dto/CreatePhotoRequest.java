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

    @Size(max = 20, message = "タイトルは20文字以内で入力してください")
    private String title;

    @NotBlank(message = "S3オブジェクトキーは必須です")
    private String s3ObjectKey;

    @NotBlank(message = "撮影日時は必須です")
    private String takenAt;

    @NotNull(message = "緯度は必須です")
    private BigDecimal latitude;

    @NotNull(message = "経度は必須です")
    private BigDecimal longitude;

    private List<String> categories;

    private String weather;

    private BigDecimal shootingDirection;

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

    private List<String> tags;

    // Getters and Setters
    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
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

    public String getWeather() {
        return weather;
    }

    public void setWeather(String weather) {
        this.weather = weather;
    }

    public BigDecimal getShootingDirection() {
        return shootingDirection;
    }

    public void setShootingDirection(BigDecimal shootingDirection) {
        this.shootingDirection = shootingDirection;
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

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }
}
