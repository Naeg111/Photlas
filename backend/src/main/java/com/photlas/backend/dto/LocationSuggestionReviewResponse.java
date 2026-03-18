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
}
