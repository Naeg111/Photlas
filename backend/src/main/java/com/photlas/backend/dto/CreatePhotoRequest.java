package com.photlas.backend.dto;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * 写真投稿リクエストDTO
 * 写真の投稿に必要な情報を格納します。
 */
public class CreatePhotoRequest {

    @NotBlank(message = "タイトルは必須です")
    @Size(min = 2, max = 20, message = "タイトルは2文字以上20文字以内で入力してください")
    private String title;

    @NotBlank(message = "S3オブジェクトキーは必須です")
    private String s3ObjectKey;

    @NotBlank(message = "撮影日時は必須です")
    private String takenAt;

    @NotNull(message = "緯度は必須です")
    private BigDecimal latitude;

    @NotNull(message = "経度は必須です")
    private BigDecimal longitude;

    @NotNull(message = "カテゴリは必須です")
    @Size(min = 1, message = "カテゴリは1つ以上選択してください")
    private List<String> categories;

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
}
