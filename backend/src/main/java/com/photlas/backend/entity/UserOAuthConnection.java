package com.photlas.backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Issue#81 Phase 2 - ユーザー OAuth 連携エンティティ（Red 段階のスケルトン）
 *
 * 1 ユーザー 1 プロバイダ制限（Round 11 / Q5）：UNIQUE(user_id, provider_code)。
 * access_token は AES-256-GCM で暗号化して保存（Round 12 / Q9）。
 */
@Entity
@Table(
        name = "user_oauth_connections",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_uoc_user_provider", columnNames = {"user_id", "provider_code"}),
                @UniqueConstraint(name = "uq_uoc_provider_user", columnNames = {"provider_code", "provider_user_id"})
        }
)
public class UserOAuthConnection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    @NotNull
    private Long userId;

    @Column(name = "provider_code", nullable = false)
    @NotNull
    private Integer providerCode;

    @Column(name = "provider_user_id", nullable = false, length = 255)
    @NotNull
    private String providerUserId;

    @Column(length = 255)
    private String email;

    @Column(name = "email_verified")
    private Boolean emailVerified;

    @Column(name = "access_token_encrypted")
    private byte[] accessTokenEncrypted;

    @Column(name = "token_encrypted_iv")
    private byte[] tokenEncryptedIv;

    @Column(name = "token_expires_at")
    private LocalDateTime tokenExpiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public UserOAuthConnection() {}

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Integer getProviderCode() {
        return providerCode;
    }

    public void setProviderCode(Integer providerCode) {
        this.providerCode = providerCode;
    }

    public String getProviderUserId() {
        return providerUserId;
    }

    public void setProviderUserId(String providerUserId) {
        this.providerUserId = providerUserId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Boolean getEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(Boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public byte[] getAccessTokenEncrypted() {
        return accessTokenEncrypted;
    }

    public void setAccessTokenEncrypted(byte[] accessTokenEncrypted) {
        this.accessTokenEncrypted = accessTokenEncrypted;
    }

    public byte[] getTokenEncryptedIv() {
        return tokenEncryptedIv;
    }

    public void setTokenEncryptedIv(byte[] tokenEncryptedIv) {
        this.tokenEncryptedIv = tokenEncryptedIv;
    }

    public LocalDateTime getTokenExpiresAt() {
        return tokenExpiresAt;
    }

    public void setTokenExpiresAt(LocalDateTime tokenExpiresAt) {
        this.tokenExpiresAt = tokenExpiresAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }
}
