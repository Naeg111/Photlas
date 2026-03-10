package com.photlas.backend.repository;

import com.photlas.backend.entity.ModerationDetail;
import com.photlas.backend.entity.ReportTargetType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Issue#54: モデレーション詳細リポジトリ
 */
@Repository
public interface ModerationDetailRepository extends JpaRepository<ModerationDetail, Long> {

    /**
     * 対象種別・対象IDでモデレーション詳細を検索
     */
    Optional<ModerationDetail> findByTargetTypeAndTargetId(ReportTargetType targetType, Long targetId);
}
