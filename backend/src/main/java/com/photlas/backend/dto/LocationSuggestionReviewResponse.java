package com.photlas.backend.dto;

import java.math.BigDecimal;

/**
 * Issue#65: レビューページ用レスポンスDTO
 */
public class LocationSuggestionReviewResponse {

    private Long suggestionId;
    private BigDecimal currentLatitude;
    private BigDecimal currentLongitude;
    private BigDecimal suggestedLatitude;
    private BigDecimal suggestedLongitude;
    private String photoTitle;
    private String imageUrl;
    private String thumbnailUrl;
    private String username;
    private String placeName;
    private String shotAt;
    private Double cropCenterX;
    private Double cropCenterY;
    private Double cropZoom;

    public Long getSuggestionId() { return suggestionId; }
    public void setSuggestionId(Long suggestionId) { this.suggestionId = suggestionId; }

    public BigDecimal getCurrentLatitude() { return currentLatitude; }
    public void setCurrentLatitude(BigDecimal currentLatitude) { this.currentLatitude = currentLatitude; }

    public BigDecimal getCurrentLongitude() { return currentLongitude; }
    public void setCurrentLongitude(BigDecimal currentLongitude) { this.currentLongitude = currentLongitude; }

    public BigDecimal getSuggestedLatitude() { return suggestedLatitude; }
    public void setSuggestedLatitude(BigDecimal suggestedLatitude) { this.suggestedLatitude = suggestedLatitude; }

    public BigDecimal getSuggestedLongitude() { return suggestedLongitude; }
    public void setSuggestedLongitude(BigDecimal suggestedLongitude) { this.suggestedLongitude = suggestedLongitude; }

    public String getPhotoTitle() { return photoTitle; }
    public void setPhotoTitle(String photoTitle) { this.photoTitle = photoTitle; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getThumbnailUrl() { return thumbnailUrl; }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = thumbnailUrl; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPlaceName() { return placeName; }
    public void setPlaceName(String placeName) { this.placeName = placeName; }

    public String getShotAt() { return shotAt; }
    public void setShotAt(String shotAt) { this.shotAt = shotAt; }

    public Double getCropCenterX() { return cropCenterX; }
    public void setCropCenterX(Double cropCenterX) { this.cropCenterX = cropCenterX; }

    public Double getCropCenterY() { return cropCenterY; }
    public void setCropCenterY(Double cropCenterY) { this.cropCenterY = cropCenterY; }

    public Double getCropZoom() { return cropZoom; }
    public void setCropZoom(Double cropZoom) { this.cropZoom = cropZoom; }
}
