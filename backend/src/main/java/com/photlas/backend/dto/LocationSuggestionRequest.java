package com.photlas.backend.dto;

import java.math.BigDecimal;

/**
 * Issue#65: 位置情報修正の指摘リクエストDTO
 */
public class LocationSuggestionRequest {

    private BigDecimal latitude;
    private BigDecimal longitude;

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
}
