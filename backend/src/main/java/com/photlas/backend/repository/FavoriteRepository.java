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
     * レポート#27-1: ユーザーIDでお気に入り一覧を取得（退会済みユーザーの写真を除外、ページネーション対応）
     */
    @Query(value = "SELECT f.* FROM favorites f " +
            "INNER JOIN photos p ON f.photo_id = p.photo_id " +
            "INNER JOIN users u ON p.user_id = u.id " +
            "WHERE f.user_id = :userId AND u.deleted_at IS NULL " +
            "ORDER BY f.created_at DESC",
            countQuery = "SELECT COUNT(*) FROM favorites f " +
            "INNER JOIN photos p ON f.photo_id = p.photo_id " +
            "INNER JOIN users u ON p.user_id = u.id " +
            "WHERE f.user_id = :userId AND u.deleted_at IS NULL",
            nativeQuery = true)
    Page<Favorite> findByUserIdExcludingDeletedUsers(@Param("userId") Long userId, Pageable pageable);

    /**
     * Issue#30: 写真IDでお気に入り数をカウント
     */
    long countByPhotoId(Long photoId);

    /**
     * Issue#108: ユーザーが付けたお気に入り全件を新しい順で取得する（エクスポート用）
     */
    java.util.List<Favorite> findByUserIdOrderByCreatedAtDesc(Long userId);
}
