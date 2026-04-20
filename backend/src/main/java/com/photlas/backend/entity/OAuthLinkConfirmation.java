package com.photlas.backend.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

/**
 * Issue#81 Phase 4g - OAuth アカウントリンク確認トークン（Q1 / V25）。
 *
 * <p>既存パスワードアカウントと OAuth 連携を確立する際の短命トークンを管理する。
 * 生トークンはクライアントに渡し、DB には SHA-256 ハッシュ（64 文字 hex）のみ保存する。
 * TTL 5 分、一度消費したら {@code consumed_at} が設定され再利用不可。
 */
@Entity
@Table(name = "oauth_link_confirmations")
public class OAuthLinkConfirmation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Hotfix: V25 migration は token_hash を CHAR(64) で作成しているため、
    // String のデフォルト (VARCHAR) ではなく CHAR として扱わせる。
    /** 生トークンの SHA-256 ハッシュ（hex 64 文字）。 */
    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    // Hotfix: V25 migration は provider_code を SMALLINT で作成しているため、
    // Integer のデフォルト (INTEGER) ではなく SMALLINT として扱わせる。
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Column(name = "provider_code", nullable = false)
    private Integer providerCode;

    @Column(name = "provider_user_id", nullable = false, length = 255)
    private String providerUserId;

    @Column(name = "provider_email", length = 255)
    private String providerEmail;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "consumed_at")
    private LocalDateTime consumedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public OAuthLinkConfirmation() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Integer getProviderCode() { return providerCode; }
    public void setProviderCode(Integer providerCode) { this.providerCode = providerCode; }

    public String getProviderUserId() { return providerUserId; }
    public void setProviderUserId(String providerUserId) { this.providerUserId = providerUserId; }

    public String getProviderEmail() { return providerEmail; }
    public void setProviderEmail(String providerEmail) { this.providerEmail = providerEmail; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public LocalDateTime getConsumedAt() { return consumedAt; }
    public void setConsumedAt(LocalDateTime consumedAt) { this.consumedAt = consumedAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
