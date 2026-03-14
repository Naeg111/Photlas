package com.photlas.backend.repository;

import com.photlas.backend.entity.PhotoCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * 写真カテゴリリポジトリ
 * 写真とカテゴリの関連付け情報のデータアクセスを提供します。
 */
@Repository
public interface PhotoCategoryRepository extends JpaRepository<PhotoCategory, PhotoCategory.PhotoCategoryId> {

    /**
     * Issue#57: 指定した写真IDに関連するカテゴリを全て削除する
     *
     * @param photoId 写真ID
     */
    void deleteByPhotoId(Long photoId);
}
