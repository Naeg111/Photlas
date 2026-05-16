package com.photlas.backend.repository;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * 写真リポジトリ
 * 写真情報のデータアクセスを提供します。
 */
@Repository
public interface PhotoRepository extends JpaRepository<Photo, Long> {

    /**
     * Issue#112: 複数スポットを横断した写真ID一覧をページング取得（撮影日時降順）
     *
     * 並び順: shot_at DESC NULLS LAST, photo_id DESC
     *  - 撮影日が新しい順
     *  - 撮影日不明（NULL）は末尾
     *  - 同時刻は photo_id 降順（新しい投稿が先）でページ境界を安定化
     *
     * フィルタ:
     *  - moderation_status = PUBLISHED 相当
     *  - 退会済みユーザー（users.deleted_at IS NOT NULL）の写真は除外
     *  - maxAgeCutoff が指定された場合、shot_at >= maxAgeCutoff のみ通す
     *    （shot_at が NULL の写真は撮影日不明としてフィルタを通過する）
     */
    @Query(value =
        "SELECT p.photo_id FROM photos p " +
        "INNER JOIN users u ON p.user_id = u.id " +
        "WHERE p.spot_id IN (:spotIds) " +
        "  AND p.moderation_status = :moderationStatus " +
        "  AND u.deleted_at IS NULL " +
        "  AND (CAST(:maxAgeCutoff AS timestamp) IS NULL OR p.shot_at IS NULL OR p.shot_at >= :maxAgeCutoff) " +
        "ORDER BY p.shot_at DESC NULLS LAST, p.photo_id DESC " +
        "LIMIT :limit OFFSET :offset",
        nativeQuery = true)
    List<Long> findPhotoIdsBySpotsPaged(
        @Param("spotIds") List<Long> spotIds,
        @Param("moderationStatus") Integer moderationStatus,
        @Param("maxAgeCutoff") LocalDateTime maxAgeCutoff,
        @Param("limit") int limit,
        @Param("offset") int offset);

    /**
     * Issue#112: 上記と同条件の総件数取得
     */
    @Query(value =
        "SELECT COUNT(*) FROM photos p " +
        "INNER JOIN users u ON p.user_id = u.id " +
        "WHERE p.spot_id IN (:spotIds) " +
        "  AND p.moderation_status = :moderationStatus " +
        "  AND u.deleted_at IS NULL " +
        "  AND (CAST(:maxAgeCutoff AS timestamp) IS NULL OR p.shot_at IS NULL OR p.shot_at >= :maxAgeCutoff)",
        nativeQuery = true)
    long countPhotosBySpots(
        @Param("spotIds") List<Long> spotIds,
        @Param("moderationStatus") Integer moderationStatus,
        @Param("maxAgeCutoff") LocalDateTime maxAgeCutoff);

    /**
     * Issue#127: 認証ユーザー本人の PENDING_REVIEW を含めて取得するバージョン。
     *
     * PUBLISHED に加え、moderation_status = 1001 かつ user_id = :viewerUserId の写真も結果に含める。
     * 他人の PENDING は除外され、プライバシーは保たれる。
     *
     * 並び順・退会済みユーザー除外・maxAgeCutoff の挙動は {@link #findPhotoIdsBySpotsPaged} と同一。
     */
    @Query(value =
        "SELECT p.photo_id FROM photos p " +
        "INNER JOIN users u ON p.user_id = u.id " +
        "WHERE p.spot_id IN (:spotIds) " +
        "  AND ( p.moderation_status = :publishedStatus " +
        "        OR (p.moderation_status = :pendingStatus AND p.user_id = :viewerUserId) ) " +
        "  AND u.deleted_at IS NULL " +
        "  AND (CAST(:maxAgeCutoff AS timestamp) IS NULL OR p.shot_at IS NULL OR p.shot_at >= :maxAgeCutoff) " +
        "ORDER BY p.shot_at DESC NULLS LAST, p.photo_id DESC " +
        "LIMIT :limit OFFSET :offset",
        nativeQuery = true)
    List<Long> findPhotoIdsBySpotsPagedWithViewer(
        @Param("spotIds") List<Long> spotIds,
        @Param("publishedStatus") Integer publishedStatus,
        @Param("pendingStatus") Integer pendingStatus,
        @Param("viewerUserId") Long viewerUserId,
        @Param("maxAgeCutoff") LocalDateTime maxAgeCutoff,
        @Param("limit") int limit,
        @Param("offset") int offset);

    /** Issue#127: {@link #findPhotoIdsBySpotsPagedWithViewer} と同条件の総件数取得 */
    @Query(value =
        "SELECT COUNT(*) FROM photos p " +
        "INNER JOIN users u ON p.user_id = u.id " +
        "WHERE p.spot_id IN (:spotIds) " +
        "  AND ( p.moderation_status = :publishedStatus " +
        "        OR (p.moderation_status = :pendingStatus AND p.user_id = :viewerUserId) ) " +
        "  AND u.deleted_at IS NULL " +
        "  AND (CAST(:maxAgeCutoff AS timestamp) IS NULL OR p.shot_at IS NULL OR p.shot_at >= :maxAgeCutoff)",
        nativeQuery = true)
    long countPhotosBySpotsWithViewer(
        @Param("spotIds") List<Long> spotIds,
        @Param("publishedStatus") Integer publishedStatus,
        @Param("pendingStatus") Integer pendingStatus,
        @Param("viewerUserId") Long viewerUserId,
        @Param("maxAgeCutoff") LocalDateTime maxAgeCutoff);

    /**
     * Issue#54: モデレーションステータスで写真を検索
     */
    List<Photo> findByModerationStatus(Integer moderationStatus);

    /**
     * Issue#54: サイトマップ用 - 公開中の写真を退会済みユーザーを除外して取得（ページネーション対応）
     */
    @Query("SELECT p FROM Photo p JOIN User u ON p.userId = u.id " +
            "WHERE p.moderationStatus = :status AND u.deletedAt IS NULL " +
            "ORDER BY p.createdAt DESC")
    Page<Photo> findPublishedPhotosExcludingDeletedUsers(
            @Param("status") Integer status, Pageable pageable);

    /**
     * Issue#54: サイトマップ用 - 公開中の写真を退会済みユーザーを除外してカウント
     */
    @Query("SELECT COUNT(p) FROM Photo p JOIN User u ON p.userId = u.id " +
            "WHERE p.moderationStatus = :status AND u.deletedAt IS NULL")
    long countPublishedPhotosExcludingDeletedUsers(@Param("status") Integer status);

    /**
     * Issue#136 Phase 2: タグ別キーワードランディングページ用。
     * 指定タグに紐づく PUBLISHED な写真を、退会済みユーザー除外で取得する。
     *
     * <p>並び順は Pageable で指定（通常 {@code created_at DESC, photo_id DESC} の決定的ソート）。</p>
     *
     * <p>{@code countQuery} を明示することで Spring の自動派生 (複雑な EXISTS で
     * 失敗・非効率になりやすい) を避ける。</p>
     */
    @Query(value =
            "SELECT p FROM Photo p " +
            "JOIN User u ON p.userId = u.id " +
            "WHERE u.deletedAt IS NULL " +
            "  AND p.moderationStatus = :publishedStatus " +
            "  AND EXISTS (SELECT 1 FROM PhotoTag pt WHERE pt.photoId = p.photoId AND pt.tagId = :tagId)",
            countQuery =
            "SELECT COUNT(p) FROM Photo p " +
            "JOIN User u ON p.userId = u.id " +
            "WHERE u.deletedAt IS NULL " +
            "  AND p.moderationStatus = :publishedStatus " +
            "  AND EXISTS (SELECT 1 FROM PhotoTag pt WHERE pt.photoId = p.photoId AND pt.tagId = :tagId)")
    Page<Photo> findActivePublishedByTagId(
            @Param("tagId") Long tagId,
            @Param("publishedStatus") Integer publishedStatus,
            Pageable pageable);

    /**
     * ユーザーIDで写真を検索し、作成日時の新しい順で返す（ページネーション対応）
     *
     * @param userId ユーザーID
     * @param pageable ページネーション情報
     * @return 写真のページ
     */
    Page<Photo> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    /**
     * Issue#54: ユーザーIDとモデレーションステータスで写真を検索（ページネーション対応）
     *
     * @param userId ユーザーID
     * @param statuses 許可するモデレーションステータスのコレクション
     * @param pageable ページネーション情報
     * @return 写真のページ
     */
    Page<Photo> findByUserIdAndModerationStatusInOrderByCreatedAtDesc(
            Long userId, Collection<Integer> statuses, Pageable pageable);

    /**
     * Issue#54: モデレーションステータスで写真を検索（管理者用、ページネーション対応）
     */
    Page<Photo> findByModerationStatusOrderByUpdatedAtDesc(
            Integer status, Pageable pageable);

    /**
     * Issue#54: S3オブジェクトキーで写真を検索（Lambdaコールバック用）
     */
    Optional<Photo> findByS3ObjectKey(String s3ObjectKey);

    /**
     * Issue#54: 指定ステータスで指定日時より前に作成された写真の件数を取得（滞留チェック用）
     */
    long countByModerationStatusAndCreatedAtBefore(Integer status, LocalDateTime createdAt);

    /**
     * Issue#54: 指定ステータスで指定日時より前に更新された写真を取得（物理削除用）
     */
    List<Photo> findByModerationStatusAndUpdatedAtBefore(Integer status, LocalDateTime updatedAt);

    /**
     * Issue#72: 指定ユーザーの全写真を取得
     */
    List<Photo> findByUserId(Long userId);

    /**
     * Issue#108: 指定ユーザーの全写真をカテゴリ JOIN FETCH で取得し、shotAt 降順で返す。
     *
     * <p>ユーザーデータエクスポートの N+1 回避用。Photo のカテゴリは ManyToMany のため、
     * 通常クエリだと写真ごとに別 SQL が走って遅くなる（N+1 問題）。LEFT JOIN FETCH で
     * 1 度の SQL にまとめる。</p>
     *
     * <p>並び順: shotAt DESC NULLS LAST, photoId DESC（撮影日時不明な写真は末尾、
     * 同時刻は新しい photoId を先に）。</p>
     */
    @Query("SELECT DISTINCT p FROM Photo p LEFT JOIN FETCH p.categories " +
           "WHERE p.userId = :userId " +
           "ORDER BY p.shotAt DESC NULLS LAST, p.photoId DESC")
    List<Photo> findByUserIdWithCategoriesOrderByShotAtDesc(@Param("userId") Long userId);

    /**
     * Issue#72: 指定スポットに写真を投稿しているアクティブユーザーのうち最も古い投稿者を取得
     */
    @org.springframework.data.jpa.repository.Query(
        value = "SELECT u.* FROM users u " +
                "INNER JOIN photos p ON u.id = p.user_id " +
                "WHERE p.spot_id = :spotId AND u.id != :excludeUserId AND u.deleted_at IS NULL " +
                "ORDER BY p.created_at ASC LIMIT 1",
        nativeQuery = true)
    java.util.Optional<com.photlas.backend.entity.User> findOldestActiveUserBySpotExcluding(
        @org.springframework.data.repository.query.Param("spotId") Long spotId,
        @org.springframework.data.repository.query.Param("excludeUserId") Long excludeUserId);
}
