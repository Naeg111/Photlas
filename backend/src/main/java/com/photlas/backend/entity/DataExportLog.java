package com.photlas.backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * データエクスポート履歴のエンティティ
 * Issue#108: ユーザー向けデータエクスポート機能
 *
 * <p>各エクスポート要求の進行状況・成否を記録し、アカウント乗っ取り疑い時の調査や
 * GDPR 説明責任原則（accountability）の根拠資料として保持する。</p>
 *
 * <p>ステータスは {@link #STATUS_IN_PROGRESS} / {@link #STATUS_COMPLETED} /
 * {@link #STATUS_FAILED} の 3 種類のみを使用する。</p>
 */
@Entity
@Table(name = "data_export_log")
public class DataExportLog {

    public static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
    public static final String STATUS_COMPLETED   = "COMPLETED";
    public static final String STATUS_FAILED      = "FAILED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    @NotNull
    private Long userId;

    @Column(name = "requested_at", nullable = false)
    @NotNull
    private LocalDateTime requestedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "status", nullable = false, length = 20)
    @NotNull
    private String status;

    @Column(name = "photo_count")
    private Integer photoCount;

    @Column(name = "estimated_size_bytes")
    private Long estimatedSizeBytes;

    @Column(name = "failure_reason", length = 1000)
    private String failureReason;

    @Column(name = "request_ip", length = 45)
    private String requestIp;

    @Column(name = "user_agent", length = 1000)
    private String userAgent;

    public DataExportLog() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public LocalDateTime getRequestedAt() { return requestedAt; }
    public void setRequestedAt(LocalDateTime requestedAt) { this.requestedAt = requestedAt; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getPhotoCount() { return photoCount; }
    public void setPhotoCount(Integer photoCount) { this.photoCount = photoCount; }

    public Long getEstimatedSizeBytes() { return estimatedSizeBytes; }
    public void setEstimatedSizeBytes(Long estimatedSizeBytes) { this.estimatedSizeBytes = estimatedSizeBytes; }

    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }

    public String getRequestIp() { return requestIp; }
    public void setRequestIp(String requestIp) { this.requestIp = requestIp; }

    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        DataExportLog that = (DataExportLog) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }
}
