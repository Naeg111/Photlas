package com.photlas.backend.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * Issue#65: 位置情報修正の指摘リクエストDTO
 */
public class LocationSuggestionRequest {

    @NotNull
    @DecimalMin("-90")
    @DecimalMax("90")
    private BigDecimal latitude;

    @NotNull
    @DecimalMin("-180")
    @DecimalMax("180")
    private BigDecimal longitude;

    public BigDecimal getLatitude() { return latitude; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }

    public BigDecimal getLongitude() { return longitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
}
