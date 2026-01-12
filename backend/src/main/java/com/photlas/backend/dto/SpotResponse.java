package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public class SpotResponse {

    @JsonProperty("spotId")
    private Long spotId;

    @JsonProperty("latitude")
    private BigDecimal latitude;

    @JsonProperty("longitude")
    private BigDecimal longitude;

    @JsonProperty("title")
    private String title;

    @JsonProperty("pinColor")
    private String pinColor;

    @JsonProperty("thumbnailUrl")
    private String thumbnailUrl;

    @JsonProperty("photoCount")
    private Integer photoCount;

    public SpotResponse() {
    }

    public SpotResponse(Long spotId, BigDecimal latitude, BigDecimal longitude, String title,
                        String pinColor, String thumbnailUrl, Integer photoCount) {
        this.spotId = spotId;
        this.latitude = latitude;
        this.longitude = longitude;
        this.title = title;
        this.pinColor = pinColor;
        this.thumbnailUrl = thumbnailUrl;
        this.photoCount = photoCount;
    }

    // Getters and Setters
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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getPinColor() {
        return pinColor;
    }

    public void setPinColor(String pinColor) {
        this.pinColor = pinColor;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }

    public void setThumbnailUrl(String thumbnailUrl) {
        this.thumbnailUrl = thumbnailUrl;
    }

    public Integer getPhotoCount() {
        return photoCount;
    }

    public void setPhotoCount(Integer photoCount) {
        this.photoCount = photoCount;
    }
}
