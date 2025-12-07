package com.photlas.backend.entity;

import jakarta.persistence.*;
import java.io.Serializable;
import java.util.Objects;

@Entity
@Table(name = "photo_categories")
@IdClass(PhotoCategory.PhotoCategoryId.class)
public class PhotoCategory {

    @Id
    @Column(name = "photo_id")
    private Long photoId;

    @Id
    @Column(name = "category_id")
    private Integer categoryId;

    // Getters and Setters
    public Long getPhotoId() {
        return photoId;
    }

    public void setPhotoId(Long photoId) {
        this.photoId = photoId;
    }

    public Integer getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(Integer categoryId) {
        this.categoryId = categoryId;
    }

    // 複合主キークラス
    public static class PhotoCategoryId implements Serializable {
        private Long photoId;
        private Integer categoryId;

        public PhotoCategoryId() {
        }

        public PhotoCategoryId(Long photoId, Integer categoryId) {
            this.photoId = photoId;
            this.categoryId = categoryId;
        }

        public Long getPhotoId() {
            return photoId;
        }

        public void setPhotoId(Long photoId) {
            this.photoId = photoId;
        }

        public Integer getCategoryId() {
            return categoryId;
        }

        public void setCategoryId(Integer categoryId) {
            this.categoryId = categoryId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            PhotoCategoryId that = (PhotoCategoryId) o;
            return Objects.equals(photoId, that.photoId) && Objects.equals(categoryId, that.categoryId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(photoId, categoryId);
        }
    }
}
