package com.photlas.backend.repository;

import com.photlas.backend.entity.Report;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Issue#19: レポートリポジトリ
 */
@Repository
public interface ReportRepository extends JpaRepository<Report, Report.ReportId> {

    /**
     * 報告ユーザーIDと写真IDでレポートを検索（重複チェック用）
     */
    Optional<Report> findByReportingUserIdAndPhotoId(Long reportingUserId, Long photoId);
}
