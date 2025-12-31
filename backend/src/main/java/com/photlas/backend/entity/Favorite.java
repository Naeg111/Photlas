package com.photlas.backend.entity;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Objects;

@Entity
@Table(name = "favorites")
@IdClass(Favorite.FavoriteId.class)
public class Favorite {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Id
    @Column(name = "photo_id")
    private Long photoId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getPhotoId() {
        return photoId;
    }

    public void setPhotoId(Long photoId) {
        this.photoId = photoId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    // 複合主キークラス
    public static class FavoriteId implements Serializable {
        private Long userId;
        private Long photoId;

        public FavoriteId() {
        }

        public FavoriteId(Long userId, Long photoId) {
            this.userId = userId;
            this.photoId = photoId;
        }

        public Long getUserId() {
            return userId;
        }

        public void setUserId(Long userId) {
            this.userId = userId;
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
            FavoriteId that = (FavoriteId) o;
            return Objects.equals(userId, that.userId) && Objects.equals(photoId, that.photoId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, photoId);
        }
    }
}
