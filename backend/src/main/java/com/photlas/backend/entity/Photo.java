package com.photlas.backend.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 写真エンティティ
 * ユーザーが投稿した写真の情報を表します。
 * 撮影スポット、カテゴリ、撮影情報などを含みます。
 */
@Entity
@Table(name = "photos", indexes = {
    @Index(name = "idx_photos_spot_id", columnList = "spot_id"),
    @Index(name = "idx_photos_user_id", columnList = "user_id"),
    @Index(name = "idx_photos_created_at", columnList = "created_at")
})
public class Photo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "photo_id")
    private Long photoId;

    @Column(name = "spot_id", nullable = false)
    private Long spotId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "s3_object_key", nullable = false, unique = true, length = 255)
    private String s3ObjectKey;

    @Column(name = "place_name", length = 100)
    private String placeName;

    @Column(name = "shot_at")
    private LocalDateTime shotAt;

    @Column(name = "weather", length = 50)
    private String weather;

    @Column(name = "time_of_day", length = 20)
    private String timeOfDay;

    @Column(name = "latitude", precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 9, scale = 6)
    private BigDecimal longitude;

    @Column(name = "device_type", length = 20)
    private String deviceType;

    @Column(name = "camera_body", length = 100)
    private String cameraBody;

    @Column(name = "camera_lens", length = 100)
    private String cameraLens;

    @Column(name = "focal_length_35mm")
    private Integer focalLength35mm;

    @Column(name = "f_value", length = 20)
    private String fValue;

    @Column(name = "shutter_speed", length = 20)
    private String shutterSpeed;

    @Column(name = "iso")
    private Integer iso;

    @Column(name = "image_width")
    private Integer imageWidth;

    @Column(name = "image_height")
    private Integer imageHeight;

    @Column(name = "crop_center_x")
    private Double cropCenterX;

    @Column(name = "crop_center_y")
    private Double cropCenterY;

    @Column(name = "crop_zoom")
    private Double cropZoom;

    @Enumerated(EnumType.STRING)
    @Column(name = "moderation_status", nullable = false, length = 20)
    private ModerationStatus moderationStatus = ModerationStatus.PENDING_REVIEW;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @ManyToMany
    @JoinTable(
        name = "photo_categories",
        joinColumns = @JoinColumn(name = "photo_id"),
        inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    private List<Category> categories = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getPhotoId() {
        return photoId;
    }

    public void setPhotoId(Long photoId) {
        this.photoId = photoId;
    }

    public Long getSpotId() {
        return spotId;
    }

    public void setSpotId(Long spotId) {
        this.spotId = spotId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getS3ObjectKey() {
        return s3ObjectKey;
    }

    public void setS3ObjectKey(String s3ObjectKey) {
        this.s3ObjectKey = s3ObjectKey;
    }

    public String getPlaceName() {
        return placeName;
    }

    public void setPlaceName(String placeName) {
        this.placeName = placeName;
    }

    public LocalDateTime getShotAt() {
        return shotAt;
    }

    public void setShotAt(LocalDateTime shotAt) {
        this.shotAt = shotAt;
    }

    public String getWeather() {
        return weather;
    }

    public void setWeather(String weather) {
        this.weather = weather;
    }

    public String getTimeOfDay() {
        return timeOfDay;
    }

    public void setTimeOfDay(String timeOfDay) {
        this.timeOfDay = timeOfDay;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
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

    public String getDeviceType() {
        return deviceType;
    }

    public void setDeviceType(String deviceType) {
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

    public ModerationStatus getModerationStatus() {
        return moderationStatus;
    }

    public void setModerationStatus(ModerationStatus moderationStatus) {
        this.moderationStatus = moderationStatus;
    }

    public List<Category> getCategories() {
        return categories;
    }

    public void setCategories(List<Category> categories) {
        this.categories = categories;
    }

}
