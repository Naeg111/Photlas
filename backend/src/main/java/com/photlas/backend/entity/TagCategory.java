package com.photlas.backend.entity;

import jakarta.persistence.*;

import java.io.Serializable;
import java.util.Objects;

/**
 * Issue#135: キーワード ↔ カテゴリ多対多の中間エンティティ。
 *
 * <p>1 つのキーワードが複数のカテゴリに属し得る（例: "Night Sky" → 星空 + 夜景）。
 * 文脈連動表示で「選択中カテゴリの主要キーワード」を引くためのインデックスとしても機能。</p>
 */
@Entity
@Table(name = "tag_categories", indexes = {
        @Index(name = "idx_tag_categories_category_code", columnList = "category_code")
})
@IdClass(TagCategory.TagCategoryId.class)
public class TagCategory {

    @Id
    @Column(name = "tag_id")
    private Long tagId;

    @Id
    @Column(name = "category_code")
    private Integer categoryCode;

    public TagCategory() {
    }

    public TagCategory(Long tagId, Integer categoryCode) {
        this.tagId = tagId;
        this.categoryCode = categoryCode;
    }

    public Long getTagId() { return tagId; }
    public void setTagId(Long tagId) { this.tagId = tagId; }

    public Integer getCategoryCode() { return categoryCode; }
    public void setCategoryCode(Integer categoryCode) { this.categoryCode = categoryCode; }

    /** JPA 複合主キークラス。 */
    public static class TagCategoryId implements Serializable {
        private Long tagId;
        private Integer categoryCode;

        public TagCategoryId() {
        }

        public TagCategoryId(Long tagId, Integer categoryCode) {
            this.tagId = tagId;
            this.categoryCode = categoryCode;
        }

        public Long getTagId() { return tagId; }
        public void setTagId(Long tagId) { this.tagId = tagId; }

        public Integer getCategoryCode() { return categoryCode; }
        public void setCategoryCode(Integer categoryCode) { this.categoryCode = categoryCode; }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            TagCategoryId that = (TagCategoryId) o;
            return Objects.equals(tagId, that.tagId) && Objects.equals(categoryCode, that.categoryCode);
        }

        @Override
        public int hashCode() {
            return Objects.hash(tagId, categoryCode);
        }
    }
}
