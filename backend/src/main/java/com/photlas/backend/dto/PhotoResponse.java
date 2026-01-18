package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public class PhotoResponse {

    private PhotoDTO photo;
    private SpotDTO spot;
    private UserDTO user;

    public PhotoResponse() {
    }

    public PhotoResponse(PhotoDTO photo, SpotDTO spot, UserDTO user) {
        this.photo = photo;
        this.spot = spot;
        this.user = user;
    }

    // Getters and Setters
    public PhotoDTO getPhoto() {
        return photo;
    }

    public void setPhoto(PhotoDTO photo) {
        this.photo = photo;
    }

    public SpotDTO getSpot() {
        return spot;
    }

    public void setSpot(SpotDTO spot) {
        this.spot = spot;
    }

    public UserDTO getUser() {
        return user;
    }

    public void setUser(UserDTO user) {
        this.user = user;
    }

    // 内部DTO: PhotoDTO
    public static class PhotoDTO {
        @JsonProperty("photo_id")
        private Long photoId;

        private String title;

        @JsonProperty("s3_object_key")
        private String s3ObjectKey;

        @JsonProperty("shot_at")
        private String shotAt;

        private String weather;

        @JsonProperty("is_favorited")
        private Boolean isFavorited;

        @JsonProperty("favorite_count")
        private Long favoriteCount;

        public PhotoDTO() {
        }

        public PhotoDTO(Long photoId, String title, String s3ObjectKey, String shotAt, String weather) {
            this.photoId = photoId;
            this.title = title;
            this.s3ObjectKey = s3ObjectKey;
            this.shotAt = shotAt;
            this.weather = weather;
            this.isFavorited = false; // デフォルトはfalse
            this.favoriteCount = 0L;
        }

        public PhotoDTO(Long photoId, String title, String s3ObjectKey, String shotAt, String weather, Boolean isFavorited) {
            this.photoId = photoId;
            this.title = title;
            this.s3ObjectKey = s3ObjectKey;
            this.shotAt = shotAt;
            this.weather = weather;
            this.isFavorited = isFavorited;
            this.favoriteCount = 0L;
        }

        public PhotoDTO(Long photoId, String title, String s3ObjectKey, String shotAt, String weather, Boolean isFavorited, Long favoriteCount) {
            this.photoId = photoId;
            this.title = title;
            this.s3ObjectKey = s3ObjectKey;
            this.shotAt = shotAt;
            this.weather = weather;
            this.isFavorited = isFavorited;
            this.favoriteCount = favoriteCount;
        }

        public Long getPhotoId() {
            return photoId;
        }

        public void setPhotoId(Long photoId) {
            this.photoId = photoId;
        }

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

        public String getShotAt() {
            return shotAt;
        }

        public void setShotAt(String shotAt) {
            this.shotAt = shotAt;
        }

        public String getWeather() {
            return weather;
        }

        public void setWeather(String weather) {
            this.weather = weather;
        }

        public Boolean getIsFavorited() {
            return isFavorited;
        }

        public void setIsFavorited(Boolean isFavorited) {
            this.isFavorited = isFavorited;
        }

        public Long getFavoriteCount() {
            return favoriteCount;
        }

        public void setFavoriteCount(Long favoriteCount) {
            this.favoriteCount = favoriteCount;
        }
    }

    // 内部DTO: SpotDTO
    public static class SpotDTO {
        @JsonProperty("spot_id")
        private Long spotId;

        private BigDecimal latitude;
        private BigDecimal longitude;

        public SpotDTO() {
        }

        public SpotDTO(Long spotId, BigDecimal latitude, BigDecimal longitude) {
            this.spotId = spotId;
            this.latitude = latitude;
            this.longitude = longitude;
        }

        public Long getSpotId() {
            return spotId;
        }

        public void setSpotId(Long spotId) {
            this.spotId = spotId;
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
    }

    // 内部DTO: UserDTO
    public static class UserDTO {
        @JsonProperty("user_id")
        private Long userId;

        private String username;

        public UserDTO() {
        }

        public UserDTO(Long userId, String username) {
            this.userId = userId;
            this.username = username;
        }

        public Long getUserId() {
            return userId;
        }

        public void setUserId(Long userId) {
            this.userId = userId;
        }

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }
    }
}
