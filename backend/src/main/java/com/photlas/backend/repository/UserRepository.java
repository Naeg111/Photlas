package com.photlas.backend.repository;

import com.photlas.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * ユーザーリポジトリ
 * ユーザー情報のデータアクセスを提供します。
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * メールアドレスでユーザーを検索
     *
     * @param email メールアドレス
     * @return ユーザー（存在しない場合はOptional.empty()）
     */
    Optional<User> findByEmail(String email);

    /**
     * メールアドレスの存在チェック
     *
     * @param email メールアドレス
     * @return メールアドレスが既に存在する場合true
     */
    boolean existsByEmail(String email);

    /**
     * 表示名でユーザーを検索
     *
     * @param username 表示名
     * @return ユーザー（存在しない場合はOptional.empty()）
     */
    Optional<User> findByUsername(String username);

    /**
     * Issue#54: プロフィール画像S3キーでユーザーを検索
     *
     * @param profileImageS3Key プロフィール画像のS3オブジェクトキー
     * @return ユーザー（存在しない場合はOptional.empty()）
     */
    Optional<User> findByProfileImageS3Key(String profileImageS3Key);

    /**
     * Issue#72: 退会済みで指定日時より前にdeleted_atが設定されたユーザーを取得
     */
    List<User> findByDeletedAtIsNotNullAndDeletedAtBefore(LocalDateTime cutoff);

    /**
     * Issue#73: 退会済みユーザー一覧（退会日の新しい順）
     */
    org.springframework.data.domain.Page<User> findByDeletedAtIsNotNullOrderByDeletedAtDesc(
            org.springframework.data.domain.Pageable pageable);

    /**
     * Issue#73: 退会済みユーザーをメールアドレスまたは元表示名で検索
     */
    @org.springframework.data.jpa.repository.Query(
            "SELECT u FROM User u WHERE u.deletedAt IS NOT NULL AND " +
            "(LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(u.originalUsername) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "ORDER BY u.deletedAt DESC")
    org.springframework.data.domain.Page<User> searchDeletedUsers(
            @org.springframework.data.repository.query.Param("search") String search,
            org.springframework.data.domain.Pageable pageable);

    /**
     * Issue#73: 退会済みで保持期間延長を考慮した物理削除対象ユーザーを取得
     */
    @org.springframework.data.jpa.repository.Query(
            "SELECT u FROM User u WHERE u.deletedAt IS NOT NULL AND u.deletedAt < :cutoff " +
            "AND (u.deletionHoldUntil IS NULL OR u.deletionHoldUntil < CURRENT_TIMESTAMP)")
    List<User> findExpiredDeletedUsers(
            @org.springframework.data.repository.query.Param("cutoff") LocalDateTime cutoff);

    /**
     * Issue#108 §4.5: 同時実行ロック取得 + 頻度制限チェックを 1 つの UPDATE で原子的に行う。
     *
     * <p>WHERE 句で「export_in_progress_at が未セット または 30 分以上前（ストール扱い）」
     * かつ「last_exported_at が未設定 または 168 時間以上前」の両方を満たすときだけ
     * UPDATE する。影響行数 1 で取得成功、0 ならロック中または頻度制限のいずれか。</p>
     *
     * @param userId        対象ユーザー ID
     * @param now           現在時刻
     * @param staleCutoff   ストール扱いの閾値（now - 30 分）
     * @param recentCutoff  頻度制限の閾値（now - 168 時間）
     * @return 影響行数（1 = 成功、0 = 失敗）
     */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "UPDATE User u SET u.exportInProgressAt = :now WHERE u.id = :userId " +
            "AND (u.exportInProgressAt IS NULL OR u.exportInProgressAt < :staleCutoff) " +
            "AND (u.lastExportedAt IS NULL OR u.lastExportedAt < :recentCutoff)")
    int tryAcquireExportSlot(
            @org.springframework.data.repository.query.Param("userId") Long userId,
            @org.springframework.data.repository.query.Param("now") LocalDateTime now,
            @org.springframework.data.repository.query.Param("staleCutoff") LocalDateTime staleCutoff,
            @org.springframework.data.repository.query.Param("recentCutoff") LocalDateTime recentCutoff);
}