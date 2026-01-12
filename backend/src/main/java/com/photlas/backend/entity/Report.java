package com.photlas.backend.entity;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Issue#19: レポートエンティティ
 * Composite PKを使用して、(reporting_user_id, photo_id)の組み合わせで重複を防止
 */
@Entity
@Table(name = "reports")
@IdClass(Report.ReportId.class)
public class Report {

    @Id
    @Column(name = "reporting_user_id")
    private Long reportingUserId;

    @Id
    @Column(name = "photo_id")
    private Long photoId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason", nullable = false, length = 50)
    private ReportReason reason;

    @Column(name = "details", nullable = false, length = 300)
    private String details;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getReportingUserId() {
        return reportingUserId;
    }

    public void setReportingUserId(Long reportingUserId) {
        this.reportingUserId = reportingUserId;
    }

    public Long getPhotoId() {
        return photoId;
    }

    public void setPhotoId(Long photoId) {
        this.photoId = photoId;
    }

    public ReportReason getReason() {
        return reason;
    }

    public void setReason(ReportReason reason) {
        this.reason = reason;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    // 複合主キークラス
    public static class ReportId implements Serializable {
        private Long reportingUserId;
        private Long photoId;

        public ReportId() {
        }

        public ReportId(Long reportingUserId, Long photoId) {
            this.reportingUserId = reportingUserId;
            this.photoId = photoId;
        }

        public Long getReportingUserId() {
            return reportingUserId;
        }

        public void setReportingUserId(Long reportingUserId) {
            this.reportingUserId = reportingUserId;
        }

        public Long getPhotoId() {
            return photoId;
        }

        public void setPhotoId(Long photoId) {
            this.photoId = photoId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            ReportId that = (ReportId) o;
            return Objects.equals(reportingUserId, that.reportingUserId) &&
                   Objects.equals(photoId, that.photoId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(reportingUserId, photoId);
        }
    }
}
