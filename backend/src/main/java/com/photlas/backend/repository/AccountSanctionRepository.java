package com.photlas.backend.repository;

import com.photlas.backend.entity.AccountSanction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Issue#54: アカウント制裁リポジトリ
 */
@Repository
public interface AccountSanctionRepository extends JpaRepository<AccountSanction, Long> {

    /**
     * ユーザーIDで制裁履歴を検索
     */
    List<AccountSanction> findByUserIdOrderByCreatedAtDesc(Long userId);
}
