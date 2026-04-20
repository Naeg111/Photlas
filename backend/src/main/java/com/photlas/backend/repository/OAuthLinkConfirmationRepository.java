package com.photlas.backend.repository;

import com.photlas.backend.entity.OAuthLinkConfirmation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Issue#81 Phase 4g - OAuth リンク確認トークンのリポジトリ（Q1 / V25）。
 */
@Repository
public interface OAuthLinkConfirmationRepository extends JpaRepository<OAuthLinkConfirmation, Long> {

    /**
     * ハッシュ化されたトークンで確認レコードを検索する。
     */
    Optional<OAuthLinkConfirmation> findByTokenHash(String tokenHash);

    /**
     * 期限切れまたは未消費のレコードをバッチで削除する（@Scheduled ジョブ用）。
     *
     * @param cutoff この時刻より expires_at が過去のレコードが対象
     * @return 削除件数
     */
    @Modifying
    @Query("DELETE FROM OAuthLinkConfirmation c WHERE c.expiresAt < :cutoff OR c.consumedAt IS NOT NULL")
    int deleteExpiredOrConsumed(LocalDateTime cutoff);
}
