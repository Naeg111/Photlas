package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.List;

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

        @JsonProperty("place_name")
        @JsonInclude(JsonInclude.Include.NON_NULL)
        private String placeName;

        @JsonProperty("image_url")
        private String imageUrl;

        @JsonProperty("shot_at")
        private String shotAt;

        private String weather;

        @JsonProperty("is_favorited")
        private Boolean isFavorited;

        @JsonProperty("favorite_count")
        private Long favoriteCount;

        @JsonProperty("latitude")
        @JsonInclude(JsonInclude.Include.NON_NULL)
        private BigDecimal latitude;

        @JsonProperty("longitude")
        @JsonInclude(JsonInclude.Include.NON_NULL)
        private BigDecimal longitude;

        @JsonInclude(JsonInclude.Include.NON_NULL)
        private ExifDTO exif;

        @JsonProperty("crop_center_x")
        @JsonInclude(JsonInclude.Include.NON_NULL)
        private Double cropCenterX;

        @JsonProperty("crop_center_y")
        @JsonInclude(JsonInclude.Include.NON_NULL)
        private Double cropCenterY;

        @JsonProperty("crop_zoom")
        @JsonInclude(JsonInclude.Include.NON_NULL)
        private Double cropZoom;

        @JsonProperty("moderation_status")
        @JsonInclude(JsonInclude.Include.NON_NULL)
        private String moderationStatus;

        @JsonProperty("thumbnail_url")
        @JsonInclude(JsonInclude.Include.NON_NULL)
        private String thumbnailUrl;

        public PhotoDTO() {
        }

        public PhotoDTO(Long photoId, String imageUrl, String shotAt, String weather) {
            this.photoId = photoId;
            this.imageUrl = imageUrl;
            this.shotAt = shotAt;
            this.weather = weather;
            this.isFavorited = false;
            this.favoriteCount = 0L;
        }

        public PhotoDTO(Long photoId, String imageUrl, String shotAt, String weather, Boolean isFavorited) {
            this.photoId = photoId;
            this.imageUrl = imageUrl;
            this.shotAt = shotAt;
            this.weather = weather;
            this.isFavorited = isFavorited;
            this.favoriteCount = 0L;
        }

        public PhotoDTO(Long photoId, String imageUrl, String shotAt, String weather, Boolean isFavorited, Long favoriteCount) {
            this.photoId = photoId;
            this.imageUrl = imageUrl;
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

        public String getPlaceName() {
            return placeName;
        }

        public void setPlaceName(String placeName) {
            this.placeName = placeName;
        }

        public String getImageUrl() {
            return imageUrl;
        }

        public void setImageUrl(String imageUrl) {
            this.imageUrl = imageUrl;
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

        public ExifDTO getExif() {
            return exif;
        }

        public void setExif(ExifDTO exif) {
            this.exif = exif;
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

        public String getModerationStatus() {
            return moderationStatus;
        }

        public void setModerationStatus(String moderationStatus) {
            this.moderationStatus = moderationStatus;
        }

        public String getThumbnailUrl() {
            return thumbnailUrl;
        }

        public void setThumbnailUrl(String thumbnailUrl) {
            this.thumbnailUrl = thumbnailUrl;
        }
    }

    /**
     * EXIF情報DTO
     * 写真のカメラ設定・機材情報を格納します。
     * 取得できた情報のみを含み、全てnullの場合はPhotoDTOのexifフィールド自体がnullになります。
     */
    public static class ExifDTO {
        @JsonProperty("camera_body")
        private String cameraBody;

        @JsonProperty("camera_lens")
        private String cameraLens;

        @JsonProperty("focal_length_35mm")
        private Integer focalLength35mm;

        @JsonProperty("f_value")
        private String fValue;

        @JsonProperty("shutter_speed")
        private String shutterSpeed;

        private Integer iso;

        @JsonProperty("image_width")
        private Integer imageWidth;

        @JsonProperty("image_height")
        private Integer imageHeight;

        /** Jackson デシリアライゼーション用のデフォルトコンストラクタ */
        public ExifDTO() {
            // Jacksonが使用するデフォルトコンストラクタ
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
