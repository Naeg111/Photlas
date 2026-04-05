package com.photlas.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Issue#54: 違反履歴エンティティ
 */
@Entity
@Table(name = "violations", indexes = {
    @Index(name = "idx_violations_user_id", columnList = "user_id")
})
public class Violation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "target_type", nullable = false)
    private Integer targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Column(name = "violation_type", nullable = false)
    private Integer violationType;

    @Column(name = "action_taken", nullable = false)
    private Integer actionTaken;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Integer getTargetType() { return targetType; }
    public void setTargetType(Integer targetType) { this.targetType = targetType; }

    public Long getTargetId() { return targetId; }
    public void setTargetId(Long targetId) { this.targetId = targetId; }

    public Integer getViolationType() { return violationType; }
    public void setViolationType(Integer violationType) { this.violationType = violationType; }

    public Integer getActionTaken() { return actionTaken; }
    public void setActionTaken(Integer actionTaken) { this.actionTaken = actionTaken; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
