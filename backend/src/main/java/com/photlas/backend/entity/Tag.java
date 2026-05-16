package com.photlas.backend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * Issue#135: キーワードマスタエンティティ。
 *
 * <p>Photlas の写真に付与可能なキーワード（ユーザー向け呼称）の母集団。
 * AWS Rekognition のラベルから Photlas 向けに選別された語彙。</p>
 *
 * <p>多対多関係:</p>
 * <ul>
 *   <li>キーワード ↔ カテゴリ: {@link TagCategory} 経由</li>
 *   <li>写真 ↔ キーワード: {@link PhotoTag} 経由</li>
 * </ul>
 *
 * <p>論理削除は {@code is_active = FALSE} で表現する。物理削除はしない方針
 * （{@code photo_tags.tag_id} の ON DELETE RESTRICT で守られている）。</p>
 */
@Entity
@Table(name = "tags", indexes = {
        @Index(name = "idx_tags_slug", columnList = "slug")
})
public class Tag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    /** Rekognition のラベル名（例: "Cherry Blossom"）。AI マッピングのキー。UNIQUE。 */
    @Column(name = "rekognition_label", nullable = false, unique = true, length = 100)
    private String rekognitionLabel;

    /** URL に使う kebab-case（例: "cherry-blossom"）。UNIQUE。 */
    @Column(name = "slug", nullable = false, unique = true, length = 100)
    private String slug;

    @Column(name = "display_name_ja", nullable = false, length = 100)
    private String displayNameJa;

    @Column(name = "display_name_en", nullable = false, length = 100)
    private String displayNameEn;

    @Column(name = "display_name_zh", length = 100)
    private String displayNameZh;

    @Column(name = "display_name_ko", length = 100)
    private String displayNameKo;

    @Column(name = "display_name_es", length = 100)
    private String displayNameEs;

    /** 表示順。同値は alphabetical で並べる。 */
    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    /** 論理削除フラグ。FALSE のキーワードは全画面で非表示。 */
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = Boolean.TRUE;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // ========== Getters / Setters ==========

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRekognitionLabel() { return rekognitionLabel; }
    public void setRekognitionLabel(String rekognitionLabel) { this.rekognitionLabel = rekognitionLabel; }

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getDisplayNameJa() { return displayNameJa; }
    public void setDisplayNameJa(String displayNameJa) { this.displayNameJa = displayNameJa; }

    public String getDisplayNameEn() { return displayNameEn; }
    public void setDisplayNameEn(String displayNameEn) { this.displayNameEn = displayNameEn; }

    public String getDisplayNameZh() { return displayNameZh; }
    public void setDisplayNameZh(String displayNameZh) { this.displayNameZh = displayNameZh; }

    public String getDisplayNameKo() { return displayNameKo; }
    public void setDisplayNameKo(String displayNameKo) { this.displayNameKo = displayNameKo; }

    public String getDisplayNameEs() { return displayNameEs; }
    public void setDisplayNameEs(String displayNameEs) { this.displayNameEs = displayNameEs; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
