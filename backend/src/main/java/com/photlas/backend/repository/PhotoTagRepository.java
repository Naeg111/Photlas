package com.photlas.backend.repository;

import com.photlas.backend.entity.PhotoTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    /** 1 つのキーワードが付いた写真数（モデレーションステータス等を考慮しない総数）。 */
    long countByTagId(Long tagId);

    /**
     * Issue#136 Phase 3: SSR ランディング表示用に「件数とグリッド表示の一致」を保証する COUNT。
     * PUBLISHED かつ退会済みユーザー除外フィルタを通した上での件数を返す。
     * {@link PhotoRepository#findActivePublishedByTagId} と同じフィルタ条件で完全に一致する。
     */
    @Query("SELECT COUNT(pt) FROM PhotoTag pt " +
            "WHERE pt.tagId = :tagId " +
            "  AND EXISTS (SELECT 1 FROM Photo p " +
            "              JOIN User u ON p.userId = u.id " +
            "              WHERE p.photoId = pt.photoId " +
            "                AND p.moderationStatus = :publishedStatus " +
            "                AND u.deletedAt IS NULL)")
    long countActivePublishedByTagId(
            @Param("tagId") Long tagId,
            @Param("publishedStatus") Integer publishedStatus);
}
