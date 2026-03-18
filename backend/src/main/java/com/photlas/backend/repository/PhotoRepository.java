package com.photlas.backend.repository;

import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
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
     * Issue#14: スポットIDで写真を検索し、撮影日時順で並び替える
     *
     * @param spotId スポットID
     * @return 写真のリスト（撮影日時の新しい順）
     */
    List<Photo> findBySpotIdOrderByShotAtAsc(Long spotId);

    /**
     * Issue#54: スポットIDとモデレーションステータスで写真を検索し、撮影日時の古い順で返す
     */
    List<Photo> findBySpotIdAndModerationStatusOrderByShotAtAsc(Long spotId, ModerationStatus moderationStatus);

    /**
     * Issue#54: モデレーションステータスで写真を検索
     */
    List<Photo> findByModerationStatus(ModerationStatus moderationStatus);

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
            Long userId, Collection<ModerationStatus> statuses, Pageable pageable);

    /**
     * Issue#54: モデレーションステータスで写真を検索（管理者用、ページネーション対応）
     */
    Page<Photo> findByModerationStatusOrderByUpdatedAtDesc(
            ModerationStatus status, Pageable pageable);

    /**
     * Issue#54: S3オブジェクトキーで写真を検索（Lambdaコールバック用）
     */
    Optional<Photo> findByS3ObjectKey(String s3ObjectKey);

    /**
     * Issue#54: 指定ステータスで指定日時より前に作成された写真の件数を取得（滞留チェック用）
     */
    long countByModerationStatusAndCreatedAtBefore(ModerationStatus status, LocalDateTime createdAt);

    /**
     * Issue#54: 指定ステータスで指定日時より前に更新された写真を取得（物理削除用）
     */
    List<Photo> findByModerationStatusAndUpdatedAtBefore(ModerationStatus status, LocalDateTime updatedAt);
}
