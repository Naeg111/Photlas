package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;

/**
 * Issue#14: 写真詳細情報レスポンスDTO
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PhotoDetailResponse {

    @JsonProperty("photoId")
    private Long photoId;

    @JsonProperty("title")
    private String title;

    @JsonProperty("imageUrls")
    private ImageUrls imageUrls;

    @JsonProperty("shotAt")
    private LocalDateTime shotAt;

    @JsonProperty("weather")
    private String weather;

    @JsonProperty("timeOfDay")
    private String timeOfDay;

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

        public ImageUrls() {}

        public ImageUrls(String thumbnail, String standard, String original) {
            this.thumbnail = thumbnail;
            this.standard = standard;
            this.original = original;
        }

        public String getThumbnail() { return thumbnail; }
        public void setThumbnail(String thumbnail) { this.thumbnail = thumbnail; }
        public String getStandard() { return standard; }
        public void setStandard(String standard) { this.standard = standard; }
        public String getOriginal() { return original; }
        public void setOriginal(String original) { this.original = original; }
    }

    public static class CameraInfo {
        @JsonProperty("body")
        private String body;

        @JsonProperty("lens")
        private String lens;

        @JsonProperty("fValue")
        private String fValue;

        @JsonProperty("shutterSpeed")
        private String shutterSpeed;

        @JsonProperty("iso")
        private String iso;

        public CameraInfo() {}

        public CameraInfo(String body, String lens, String fValue, String shutterSpeed, String iso) {
            this.body = body;
            this.lens = lens;
            this.fValue = fValue;
            this.shutterSpeed = shutterSpeed;
            this.iso = iso;
        }

        public String getBody() { return body; }
        public void setBody(String body) { this.body = body; }
        public String getLens() { return lens; }
        public void setLens(String lens) { this.lens = lens; }
        public String getFValue() { return fValue; }
        public void setFValue(String fValue) { this.fValue = fValue; }
        public String getShutterSpeed() { return shutterSpeed; }
        public void setShutterSpeed(String shutterSpeed) { this.shutterSpeed = shutterSpeed; }
        public String getIso() { return iso; }
        public void setIso(String iso) { this.iso = iso; }
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

        public SpotInfo() {}

        public SpotInfo(Long spotId) {
            this.spotId = spotId;
        }

        public Long getSpotId() { return spotId; }
        public void setSpotId(Long spotId) { this.spotId = spotId; }
    }

    // Main class constructors
    public PhotoDetailResponse() {}

    // Getters and Setters
    public Long getPhotoId() { return photoId; }
    public void setPhotoId(Long photoId) { this.photoId = photoId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public ImageUrls getImageUrls() { return imageUrls; }
    public void setImageUrls(ImageUrls imageUrls) { this.imageUrls = imageUrls; }
    public LocalDateTime getShotAt() { return shotAt; }
    public void setShotAt(LocalDateTime shotAt) { this.shotAt = shotAt; }
    public String getWeather() { return weather; }
    public void setWeather(String weather) { this.weather = weather; }
    public String getTimeOfDay() { return timeOfDay; }
    public void setTimeOfDay(String timeOfDay) { this.timeOfDay = timeOfDay; }
    public String getSubjectCategory() { return subjectCategory; }
    public void setSubjectCategory(String subjectCategory) { this.subjectCategory = subjectCategory; }
    public CameraInfo getCameraInfo() { return cameraInfo; }
    public void setCameraInfo(CameraInfo cameraInfo) { this.cameraInfo = cameraInfo; }
    public UserInfo getUser() { return user; }
    public void setUser(UserInfo user) { this.user = user; }
    public SpotInfo getSpot() { return spot; }
    public void setSpot(SpotInfo spot) { this.spot = spot; }
}
