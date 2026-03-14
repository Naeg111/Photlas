package com.photlas.backend.repository;

import com.photlas.backend.entity.Report;
import com.photlas.backend.entity.ReportTargetType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Issue#54: 通報リポジトリ
 */
@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {

    /**
     * 通報ユーザーID・対象種別・対象IDで通報を検索（重複チェック用）
     */
    Optional<Report> findByReporterUserIdAndTargetTypeAndTargetId(
            Long reporterUserId, ReportTargetType targetType, Long targetId);

    /**
     * 対象種別・対象IDで通報件数をカウント
     */
    long countByTargetTypeAndTargetId(ReportTargetType targetType, Long targetId);

    /**
     * Issue#57: 対象種別・対象IDで通報を全て削除する
     */
    void deleteByTargetTypeAndTargetId(ReportTargetType targetType, Long targetId);
}
