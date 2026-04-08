package com.photlas.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Issue#54: モデレーション詳細エンティティ
 * AI検知結果や隔離日時などの詳細情報を管理する
 */
@Entity
@Table(name = "moderation_details", indexes = {
    @Index(name = "idx_moderation_details_target", columnList = "target_type, target_id")
})
public class ModerationDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "target_type", nullable = false)
    private Integer targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Column(name = "source", nullable = false)
    private Integer source;

    @Column(name = "ai_confidence_score")
    private Double aiConfidenceScore;

    @Column(name = "is_csam_flagged", nullable = false)
    private boolean csamFlagged = false;

    @Column(name = "quarantined_at")
    private LocalDateTime quarantinedAt;

    @Column(name = "removed_at")
    private LocalDateTime removedAt;

    @Column(name = "scheduled_deletion_at")
    private LocalDateTime scheduledDeletionAt;

    @Column(name = "detected_labels")
    private String detectedLabels;

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Integer getTargetType() { return targetType; }
    public void setTargetType(Integer targetType) { this.targetType = targetType; }

    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }

    public Integer getSource() { return source; }
    public void setSource(Integer source) { this.source = source; }

    public Double getAiConfidenceScore() { return aiConfidenceScore; }
    public void setAiConfidenceScore(Double aiConfidenceScore) { this.aiConfidenceScore = aiConfidenceScore; }

    public boolean isCsamFlagged() { return csamFlagged; }
    public void setCsamFlagged(boolean csamFlagged) { this.csamFlagged = csamFlagged; }

    public LocalDateTime getQuarantinedAt() { return quarantinedAt; }
    public void setQuarantinedAt(LocalDateTime quarantinedAt) { this.quarantinedAt = quarantinedAt; }

    public LocalDateTime getRemovedAt() { return removedAt; }
    public void setRemovedAt(LocalDateTime removedAt) { this.removedAt = removedAt; }

    public LocalDateTime getScheduledDeletionAt() { return scheduledDeletionAt; }
    public void setScheduledDeletionAt(LocalDateTime scheduledDeletionAt) { this.scheduledDeletionAt = scheduledDeletionAt; }

    public String getDetectedLabels() { return detectedLabels; }
    public void setDetectedLabels(String detectedLabels) { this.detectedLabels = detectedLabels; }
}
