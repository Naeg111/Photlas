package com.photlas.backend.repository;

import com.photlas.backend.entity.PhotoTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Issue#135: 写真 ↔ キーワード多対多リポジトリ。
 */
@Repository
public interface PhotoTagRepository extends JpaRepository<PhotoTag, PhotoTag.PhotoTagId> {

    /** 1 枚の写真に付いた全キーワード関連を取得。 */
    List<PhotoTag> findByPhotoId(Long photoId);

    /** 複数写真に付いた全キーワード関連を一括取得（検索結果カード等）。 */
    List<PhotoTag> findByPhotoIdIn(List<Long> photoIds);

    /** 1 つのキーワードが付いた写真数（ランディングページ用）。 */
    long countByTagId(Long tagId);
}
