package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Issue#14: 写真詳細情報レスポンスDTO
 * Issue#88: フィールド追加（placeName, isFavorited, favoriteCount, 座標, crop, moderationStatus, categories等）
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PhotoDetailResponse {

    @JsonProperty("photoId")
    private Long photoId;

    @JsonProperty("imageUrls")
    private ImageUrls imageUrls;

    @JsonProperty("placeName")
    private String placeName;

    @JsonProperty("shotAt")
    private LocalDateTime shotAt;

    @JsonProperty("weather")
    private Integer weather;

    @JsonProperty("isFavorited")
    private Boolean isFavorited;

    @JsonProperty("favoriteCount")
    private Long favoriteCount;

    @JsonProperty("latitude")
    private BigDecimal latitude;

    @JsonProperty("longitude")
    private BigDecimal longitude;

    @JsonProperty("cropCenterX")
    private Double cropCenterX;

    @JsonProperty("cropCenterY")
    private Double cropCenterY;

    @JsonProperty("cropZoom")
    private Double cropZoom;

    @JsonProperty("moderationStatus")
    private Integer moderationStatus;

    @JsonProperty("categories")
    private List<String> categories;

    @JsonProperty("timeOfDay")
    private Integer timeOfDay;

    @JsonProperty("subjectCategory")
    private String subjectCategory;

    @JsonProperty("cameraInfo")
    private CameraInfo cameraInfo;

    @JsonProperty("user")
    private UserInfo user;

    @JsonProperty("spot")
    private SpotInfo spot;

    // Inner classes
    public static class ImageUrls {
        @JsonProperty("thumbnail")
        private String thumbnail;

        @JsonProperty("standard")
        private String standard;

        @JsonProperty("original")
        private String original;

        /**
         * Issue#125: LQIP（低品質プレースホルダー）の data URL 形式。
         * モデレーション制限中（REMOVED/QUARANTINED/PENDING_REVIEW）は null（実画像漏れ防止）。
         * Lambda コールバック未到達の場合も null（フロントが従来挙動にフォールバック）。
         */
        @JsonProperty("lqip")
        private String lqip;

        public ImageUrls() {}

        public ImageUrls(String thumbnail, String standard, String original) {
            this.thumbnail = thumbnail;
            this.standard = standard;
            this.original = original;
        }

        public ImageUrls(String thumbnail, String standard, String original, String lqip) {
            this.thumbnail = thumbnail;
            this.standard = standard;
            this.original = original;
            this.lqip = lqip;
        }

        public String getThumbnail() { return thumbnail; }
        public void setThumbnail(String thumbnail) { this.thumbnail = thumbnail; }
        public String getStandard() { return standard; }
        public void setStandard(String standard) { this.standard = standard; }
        public String getOriginal() { return original; }
        public void setOriginal(String original) { this.original = original; }
        public String getLqip() { return lqip; }
        public void setLqip(String lqip) { this.lqip = lqip; }
    }

    public static class CameraInfo {
        @JsonProperty("body")
        private String body;

        @JsonProperty("lens")
        private String lens;

        @JsonProperty("focalLength35mm")
        private Integer focalLength35mm;

        @JsonProperty("fValue")
        private String fValue;

        @JsonProperty("shutterSpeed")
        private String shutterSpeed;

        @JsonProperty("iso")
        private String iso;

        @JsonProperty("imageWidth")
        private Integer imageWidth;

        @JsonProperty("imageHeight")
        private Integer imageHeight;

        public CameraInfo() {}

        public CameraInfo(String body, String lens, Integer focalLength35mm, String fValue,
                          String shutterSpeed, String iso, Integer imageWidth, Integer imageHeight) {
            this.body = body;
            this.lens = lens;
            this.focalLength35mm = focalLength35mm;
            this.fValue = fValue;
            this.shutterSpeed = shutterSpeed;
            this.iso = iso;
            this.imageWidth = imageWidth;
            this.imageHeight = imageHeight;
        }

        public String getBody() { return body; }
        public void setBody(String body) { this.body = body; }
        public String getLens() { return lens; }
        public void setLens(String lens) { this.lens = lens; }
        public Integer getFocalLength35mm() { return focalLength35mm; }
        public void setFocalLength35mm(Integer focalLength35mm) { this.focalLength35mm = focalLength35mm; }
        public String getFValue() { return fValue; }
        public void setFValue(String fValue) { this.fValue = fValue; }
        public String getShutterSpeed() { return shutterSpeed; }
        public void setShutterSpeed(String shutterSpeed) { this.shutterSpeed = shutterSpeed; }
        public String getIso() { return iso; }
        public void setIso(String iso) { this.iso = iso; }
        public Integer getImageWidth() { return imageWidth; }
        public void setImageWidth(Integer imageWidth) { this.imageWidth = imageWidth; }
        public Integer getImageHeight() { return imageHeight; }
        public void setImageHeight(Integer imageHeight) { this.imageHeight = imageHeight; }
    }

    public static class UserInfo {
        @JsonProperty("userId")
        private Long userId;

        @JsonProperty("username")
        private String username;

        @JsonProperty("profileImageUrl")
        private String profileImageUrl;

        @JsonProperty("snsLinks")
        private SnsLinks snsLinks;

        public UserInfo() {}

        public UserInfo(Long userId, String username, String profileImageUrl, SnsLinks snsLinks) {
            this.userId = userId;
            this.username = username;
            this.profileImageUrl = profileImageUrl;
            this.snsLinks = snsLinks;
        }

        public Long getUserId() { return userId; }
        public void setUserId(Long userId) { this.userId = userId; }
        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getProfileImageUrl() { return profileImageUrl; }
        public void setProfileImageUrl(String profileImageUrl) { this.profileImageUrl = profileImageUrl; }
        public SnsLinks getSnsLinks() { return snsLinks; }
        public void setSnsLinks(SnsLinks snsLinks) { this.snsLinks = snsLinks; }
    }

    public static class SnsLinks {
        @JsonProperty("twitter")
        private String twitter;

        @JsonProperty("instagram")
        private String instagram;

        public SnsLinks() {}

        public SnsLinks(String twitter, String instagram) {
            this.twitter = twitter;
            this.instagram = instagram;
        }

        public String getTwitter() { return twitter; }
        public void setTwitter(String twitter) { this.twitter = twitter; }
        public String getInstagram() { return instagram; }
        public void setInstagram(String instagram) { this.instagram = instagram; }
    }

    public static class SpotInfo {
        @JsonProperty("spotId")
        private Long spotId;

        @JsonProperty("latitude")
        private BigDecimal latitude;

        @JsonProperty("longitude")
        private BigDecimal longitude;

        public SpotInfo() {}

        public SpotInfo(Long spotId, BigDecimal latitude, BigDecimal longitude) {
            this.spotId = spotId;
            this.latitude = latitude;
            this.longitude = longitude;
        }

        public Long getSpotId() { return spotId; }
        public void setSpotId(Long spotId) { this.spotId = spotId; }
        public BigDecimal getLatitude() { return latitude; }
        public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
        public BigDecimal getLongitude() { return longitude; }
        public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    }

    /** Jackson デシリアライゼーション用のデフォルトコンストラクタ */
    public PhotoDetailResponse() {
    }

    // Getters and Setters
    public Long getPhotoId() { return photoId; }
    public void setPhotoId(Long photoId) { this.photoId = photoId; }
    public ImageUrls getImageUrls() { return imageUrls; }
    public void setImageUrls(ImageUrls imageUrls) { this.imageUrls = imageUrls; }
    public String getPlaceName() { return placeName; }
    public void setPlaceName(String placeName) { this.placeName = placeName; }
    public LocalDateTime getShotAt() { return shotAt; }
    public void setShotAt(LocalDateTime shotAt) { this.shotAt = shotAt; }
    public Integer getWeather() { return weather; }
    public void setWeather(Integer weather) { this.weather = weather; }
    public Boolean getIsFavorited() { return isFavorited; }
    public void setIsFavorited(Boolean isFavorited) { this.isFavorited = isFavorited; }
    public Long getFavoriteCount() { return favoriteCount; }
    public void setFavoriteCount(Long favoriteCount) { this.favoriteCount = favoriteCount; }
    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    public Double getCropCenterX() { return cropCenterX; }
    public void setCropCenterX(Double cropCenterX) { this.cropCenterX = cropCenterX; }
    public Double getCropCenterY() { return cropCenterY; }
    public void setCropCenterY(Double cropCenterY) { this.cropCenterY = cropCenterY; }
    public Double getCropZoom() { return cropZoom; }
    public void setCropZoom(Double cropZoom) { this.cropZoom = cropZoom; }
    public Integer getModerationStatus() { return moderationStatus; }
    public void setModerationStatus(Integer moderationStatus) { this.moderationStatus = moderationStatus; }
    public List<String> getCategories() { return categories; }
    public void setCategories(List<String> categories) { this.categories = categories; }
    public Integer getTimeOfDay() { return timeOfDay; }
    public void setTimeOfDay(Integer timeOfDay) { this.timeOfDay = timeOfDay; }
    public String getSubjectCategory() { return subjectCategory; }
    public void setSubjectCategory(String subjectCategory) { this.subjectCategory = subjectCategory; }
    public CameraInfo getCameraInfo() { return cameraInfo; }
    public void setCameraInfo(CameraInfo cameraInfo) { this.cameraInfo = cameraInfo; }
    public UserInfo getUser() { return user; }
    public void setUser(UserInfo user) { this.user = user; }
    public SpotInfo getSpot() { return spot; }
    public void setSpot(SpotInfo spot) { this.spot = spot; }
}
