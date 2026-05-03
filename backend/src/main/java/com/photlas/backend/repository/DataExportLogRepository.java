package com.photlas.backend.repository;

import com.photlas.backend.entity.DataExportLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * データエクスポート履歴リポジトリ
 * Issue#108: ユーザー向けデータエクスポート機能
 */
@Repository
public interface DataExportLogRepository extends JpaRepository<DataExportLog, Long> {

    /**
     * 指定ユーザーのエクスポート履歴を新しい順（requested_at 降順）で取得する。
     *
     * @param userId 対象ユーザー ID
     * @return エクスポート履歴一覧（新しい順）
     */
    List<DataExportLog> findByUserIdOrderByRequestedAtDesc(Long userId);
}
