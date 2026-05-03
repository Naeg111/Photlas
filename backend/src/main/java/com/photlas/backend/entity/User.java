package com.photlas.backend.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.Objects;

/**
 * ユーザーエンティティ
 * Photlasアプリケーションのユーザー情報を表します。
 */
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 12)
    @NotNull
    @Size(min = 2, max = 12)
    private String username;

    @Column(nullable = false, unique = true, length = 255)
    @NotNull
    @Email
    private String email;

    // Issue#81: OAuth のみユーザーは password_hash が null になる（V22 で NULLABLE 化）
    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(nullable = false)
    @NotNull
    private Integer role;

    @Column(name = "profile_image_s3_key", length = 512)
    private String profileImageS3Key;

    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @Column(name = "original_username", length = 12)
    private String originalUsername;

    @Column(name = "deletion_hold_until")
    private LocalDateTime deletionHoldUntil;

    @Column(name = "language", nullable = false, length = 5)
    private String language = "ja";

    // Issue#81: OAuth 初回ログイン時に仮表示名を設定し、確定画面でフラグを false にする
    @Column(name = "username_temporary", nullable = false)
    private boolean usernameTemporary = false;

    // Issue#81 / Q8: パスワード推奨バナーを却下した時刻（7 日間非表示用）
    @Column(name = "password_recommendation_dismissed_at")
    private LocalDateTime passwordRecommendationDismissedAt;

    // Issue#104: 利用規約への同意日時（NULL の場合は未同意）
    @Column(name = "terms_agreed_at")
    private LocalDateTime termsAgreedAt;

    // Issue#104: プライバシーポリシーへの同意日時（NULL の場合は未同意）
    @Column(name = "privacy_policy_agreed_at")
    private LocalDateTime privacyPolicyAgreedAt;

    // Issue#109: 年齢確認（13 歳以上）の自己申告日時（NULL の場合は未確認）
    @Column(name = "age_confirmed_at")
    private LocalDateTime ageConfirmedAt;

    // Issue#108: 最後にデータエクスポートが正常完了した日時（頻度制限用、未エクスポートなら null）
    @Column(name = "last_exported_at")
    private LocalDateTime lastExportedAt;

    // Issue#108: データエクスポート進行中フラグ（同時実行制御用、開始時セット・完了/失敗時クリア）
    @Column(name = "export_in_progress_at")
    private LocalDateTime exportInProgressAt;

    public User() {}

    public User(String username, String email, String passwordHash, Integer role) {
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public Integer getRole() {
        return role;
    }

    public void setRole(Integer role) {
        this.role = role;
    }

    public String getProfileImageS3Key() {
        return profileImageS3Key;
    }

    public void setProfileImageS3Key(String profileImageS3Key) {
        this.profileImageS3Key = profileImageS3Key;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public LocalDateTime getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(LocalDateTime deletedAt) {
        this.deletedAt = deletedAt;
    }

    public String getOriginalUsername() {
        return originalUsername;
    }

    public void setOriginalUsername(String originalUsername) {
        this.originalUsername = originalUsername;
    }

    public LocalDateTime getDeletionHoldUntil() {
        return deletionHoldUntil;
    }

    public void setDeletionHoldUntil(LocalDateTime deletionHoldUntil) {
        this.deletionHoldUntil = deletionHoldUntil;
    }

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }

    public boolean isUsernameTemporary() {
        return usernameTemporary;
    }

    public void setUsernameTemporary(boolean usernameTemporary) {
        this.usernameTemporary = usernameTemporary;
    }

    public LocalDateTime getPasswordRecommendationDismissedAt() {
        return passwordRecommendationDismissedAt;
    }

    public void setPasswordRecommendationDismissedAt(LocalDateTime passwordRecommendationDismissedAt) {
        this.passwordRecommendationDismissedAt = passwordRecommendationDismissedAt;
    }

    public LocalDateTime getTermsAgreedAt() {
        return termsAgreedAt;
    }

    public void setTermsAgreedAt(LocalDateTime termsAgreedAt) {
        this.termsAgreedAt = termsAgreedAt;
    }

    public LocalDateTime getPrivacyPolicyAgreedAt() {
        return privacyPolicyAgreedAt;
    }

    public void setPrivacyPolicyAgreedAt(LocalDateTime privacyPolicyAgreedAt) {
        this.privacyPolicyAgreedAt = privacyPolicyAgreedAt;
    }

    public LocalDateTime getAgeConfirmedAt() {
        return ageConfirmedAt;
    }

    public void setAgeConfirmedAt(LocalDateTime ageConfirmedAt) {
        this.ageConfirmedAt = ageConfirmedAt;
    }

    public LocalDateTime getLastExportedAt() {
        return lastExportedAt;
    }

    public void setLastExportedAt(LocalDateTime lastExportedAt) {
        this.lastExportedAt = lastExportedAt;
    }

    public LocalDateTime getExportInProgressAt() {
        return exportInProgressAt;
    }

    public void setExportInProgressAt(LocalDateTime exportInProgressAt) {
        this.exportInProgressAt = exportInProgressAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        User user = (User) o;
        return Objects.equals(id, user.id) &&
               Objects.equals(email, user.email);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, email);
    }

    @Override
    public String toString() {
        return "User{" +
               "id=" + id +
               ", username='" + username + '\'' +
               ", email='" + email + '\'' +
               ", role=" + role +
               ", createdAt=" + createdAt +
               ", updatedAt=" + updatedAt +
               '}';
    }
}