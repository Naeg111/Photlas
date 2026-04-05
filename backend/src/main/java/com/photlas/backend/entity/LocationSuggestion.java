package com.photlas.backend.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Issue#65: 位置情報修正の指摘エンティティ
 */
@Entity
@Table(name = "location_suggestions", indexes = {
    @Index(name = "idx_location_suggestions_photo_id", columnList = "photo_id"),
    @Index(name = "idx_location_suggestions_status", columnList = "status"),
    @Index(name = "idx_location_suggestions_review_token", columnList = "review_token")
}, uniqueConstraints = {
    @UniqueConstraint(columnNames = {"photo_id", "suggester_id"})
})
public class LocationSuggestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "photo_id", nullable = false)
    private Long photoId;

    @Column(name = "suggester_id", nullable = false)
    private Long suggesterId;

    @Column(name = "suggested_latitude", nullable = false, precision = 9, scale = 6)
    private BigDecimal suggestedLatitude;

    @Column(name = "suggested_longitude", nullable = false, precision = 9, scale = 6)
    private BigDecimal suggestedLongitude;

    @Column(name = "status", nullable = false)
    private Integer status = 1201;

    @Column(name = "review_token", unique = true)
    private String reviewToken;

    @Column(name = "email_sent", nullable = false)
    private boolean emailSent = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getPhotoId() { return photoId; }
    public void setPhotoId(Long photoId) { this.photoId = photoId; }

    public Long getSuggesterId() { return suggesterId; }
    public void setSuggesterId(Long suggesterId) { this.suggesterId = suggesterId; }

    public BigDecimal getSuggestedLatitude() { return suggestedLatitude; }
    public void setSuggestedLatitude(BigDecimal suggestedLatitude) { this.suggestedLatitude = suggestedLatitude; }

    public BigDecimal getSuggestedLongitude() { return suggestedLongitude; }
    public void setSuggestedLongitude(BigDecimal suggestedLongitude) { this.suggestedLongitude = suggestedLongitude; }

    public Integer getStatus() { return status; }
    public void setStatus(Integer status) { this.status = status; }

    public String getReviewToken() { return reviewToken; }
    public void setReviewToken(String reviewToken) { this.reviewToken = reviewToken; }

    public boolean isEmailSent() { return emailSent; }
    public void setEmailSent(boolean emailSent) { this.emailSent = emailSent; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }
}
