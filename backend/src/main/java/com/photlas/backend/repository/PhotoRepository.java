package com.photlas.backend.repository;

import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

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
}
