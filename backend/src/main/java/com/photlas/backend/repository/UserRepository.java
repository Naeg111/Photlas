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
     * ユーザー名でユーザーを検索
     *
     * @param username ユーザー名
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
     * Issue#73: 退会済みユーザーをメールアドレスまたは元ユーザー名で検索
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
}