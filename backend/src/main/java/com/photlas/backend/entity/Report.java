package com.photlas.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Issue#54: 通報エンティティ
 * 投稿およびプロフィール画像に対する通報を管理する
 */
@Entity
@Table(name = "reports", indexes = {
    @Index(name = "idx_reports_target", columnList = "target_type, target_id")
}, uniqueConstraints = {
    @UniqueConstraint(name = "uk_reports_reporter_target",
            columnNames = {"reporter_user_id", "target_type", "target_id"})
})
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "reporter_user_id", nullable = false)
    private Long reporterUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", nullable = false, length = 20)
    private ReportTargetType targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason_category", nullable = false, length = 50)
    private ReportReason reasonCategory;

    @Column(name = "reason_text", length = 300)
    private String reasonText;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getReporterUserId() {
        return reporterUserId;
    }

    public void setReporterUserId(Long reporterUserId) {
        this.reporterUserId = reporterUserId;
    }

    public ReportTargetType getTargetType() {
        return targetType;
    }

    public void setTargetType(ReportTargetType targetType) {
        this.targetType = targetType;
    }

    public Long getTargetId() {
        return targetId;
    }

    public void setTargetId(Long targetId) {
        this.targetId = targetId;
    }

    public ReportReason getReasonCategory() {
        return reasonCategory;
    }

    public void setReasonCategory(ReportReason reasonCategory) {
        this.reasonCategory = reasonCategory;
    }

    public String getReasonText() {
        return reasonText;
    }

    public void setReasonText(String reasonText) {
        this.reasonText = reasonText;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
