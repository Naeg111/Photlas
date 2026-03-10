package com.photlas.backend.repository;

import com.photlas.backend.entity.Violation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Issue#54: 違反履歴リポジトリ
 */
@Repository
public interface ViolationRepository extends JpaRepository<Violation, Long> {

    /**
     * ユーザーIDで違反件数をカウント
     */
    long countByUserId(Long userId);
}
