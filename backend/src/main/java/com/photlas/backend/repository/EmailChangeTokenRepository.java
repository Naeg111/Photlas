package com.photlas.backend.repository;

import com.photlas.backend.entity.EmailChangeToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.Optional;

/**
 * メールアドレス変更確認トークンのリポジトリ
 * Issue#86: メールアドレス変更時の確認メール送信機能
 */
@Repository
public interface EmailChangeTokenRepository extends JpaRepository<EmailChangeToken, Long> {
    Optional<EmailChangeToken> findByToken(String token);
    Optional<EmailChangeToken> findByUserId(Long userId);
    void deleteByUserId(Long userId);
    void deleteByExpiryDateBefore(Date now);
}
