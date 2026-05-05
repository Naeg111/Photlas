package com.photlas.backend.repository;

import com.photlas.backend.entity.AiPredictionCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Date;

/**
 * Issue#119: AI 予測結果の一時保管リポジトリ。
 */
@Repository
public interface AiPredictionCacheRepository extends JpaRepository<AiPredictionCache, String> {

    /**
     * 指定日時より前に期限切れになっているトークンを一括削除する。
     *
     * @param now 現在日時。これより前に {@code expiresAt} が設定されているレコードが対象
     */
    void deleteByExpiresAtBefore(Date now);
}
