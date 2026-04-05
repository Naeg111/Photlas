package com.photlas.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Issue#54: アカウント制裁エンティティ
 */
@Entity
@Table(name = "account_sanctions", indexes = {
    @Index(name = "idx_account_sanctions_user_id", columnList = "user_id")
})
public class AccountSanction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "sanction_type", nullable = false)
    private Integer sanctionType;

    @Column(name = "reason", length = 500)
    private String reason;

    @Column(name = "suspended_until")
    private LocalDateTime suspendedUntil;

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

    public Integer getSanctionType() { return sanctionType; }
    public void setSanctionType(Integer sanctionType) { this.sanctionType = sanctionType; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public LocalDateTime getSuspendedUntil() { return suspendedUntil; }
    public void setSuspendedUntil(LocalDateTime suspendedUntil) { this.suspendedUntil = suspendedUntil; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
