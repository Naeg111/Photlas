package com.photlas.backend.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * Issue#135: 写真 ↔ キーワード多対多の中間エンティティ。
 *
 * <p>{@code assigned_by} で AI 自動付与か手動追加かを区別する。
 * AI 由来時のみ {@code aiConfidence} に Rekognition 信頼度（0〜100）を保存。</p>
 *
 * <p>外部キー方針:</p>
 * <ul>
 *   <li>{@code photo_id}: 写真削除で連動削除（ON DELETE CASCADE）</li>
 *   <li>{@code tag_id}: 誤削除事故防止のため RESTRICT。タグは {@code is_active=FALSE} で論理削除する</li>
 * </ul>
 */
@Entity
@Table(name = "photo_tags", indexes = {
        @Index(name = "idx_photo_tags_tag_id", columnList = "tag_id")
})
@IdClass(PhotoTag.PhotoTagId.class)
public class PhotoTag {

    /** AI 自動付与を示す {@code assigned_by} 値。 */
    public static final String ASSIGNED_BY_AI = "AI";

    /** ユーザー手動追加を示す {@code assigned_by} 値。 */
    public static final String ASSIGNED_BY_USER = "USER";

    @Id
    @Column(name = "photo_id")
    private Long photoId;

    @Id
    @Column(name = "tag_id")
    private Long tagId;

    @Column(name = "assigned_by", nullable = false, length = 10)
    private String assignedBy;

    /** AI 由来時の Rekognition 信頼度（0〜100）。USER 由来時は NULL。 */
    @Column(name = "ai_confidence")
    private Double aiConfidence;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public PhotoTag() {
    }

    public PhotoTag(Long photoId, Long tagId) {
        this.photoId = photoId;
        this.tagId = tagId;
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public Long getPhotoId() { return photoId; }
    public void setPhotoId(Long photoId) { this.photoId = photoId; }

    public Long getTagId() { return tagId; }
    public void setTagId(Long tagId) { this.tagId = tagId; }

    public String getAssignedBy() { return assignedBy; }
    public void setAssignedBy(String assignedBy) { this.assignedBy = assignedBy; }

    public Double getAiConfidence() { return aiConfidence; }
    public void setAiConfidence(Double aiConfidence) { this.aiConfidence = aiConfidence; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /** JPA 複合主キークラス。 */
    public static class PhotoTagId implements Serializable {
        private Long photoId;
        private Long tagId;

        public PhotoTagId() {
        }

        public PhotoTagId(Long photoId, Long tagId) {
            this.photoId = photoId;
            this.tagId = tagId;
        }

        public Long getPhotoId() { return photoId; }
        public void setPhotoId(Long photoId) { this.photoId = photoId; }

        public Long getTagId() { return tagId; }
        public void setTagId(Long tagId) { this.tagId = tagId; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            PhotoTagId that = (PhotoTagId) o;
            return Objects.equals(photoId, that.photoId) && Objects.equals(tagId, that.tagId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(photoId, tagId);
        }
    }
}
