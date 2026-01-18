package com.photlas.backend.repository;

import com.photlas.backend.entity.Favorite;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * お気に入りリポジトリ
 * ユーザーのお気に入り写真情報のデータアクセスを提供します。
 */
@Repository
public interface FavoriteRepository extends JpaRepository<Favorite, Favorite.FavoriteId> {

    /**
     * ユーザーIDと写真IDでお気に入りを検索
     */
    Optional<Favorite> findByUserIdAndPhotoId(Long userId, Long photoId);

    /**
     * ユーザーIDでお気に入り一覧を取得（ページネーション対応、created_atの降順）
     */
    @Query("SELECT f FROM Favorite f WHERE f.userId = :userId ORDER BY f.createdAt DESC")
    Page<Favorite> findByUserId(@Param("userId") Long userId, Pageable pageable);

    /**
     * Issue#30: 写真IDでお気に入り数をカウント
     */
    long countByPhotoId(Long photoId);
}
