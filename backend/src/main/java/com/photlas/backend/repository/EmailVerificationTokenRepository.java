package com.photlas.backend.repository;

import com.photlas.backend.entity.EmailVerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * メール認証トークンのリポジトリ
 */
@Repository
public interface EmailVerificationTokenRepository extends JpaRepository<EmailVerificationToken, Long> {
    /**
     * トークン文字列からメール認証トークンを検索
     *
     * @param token トークン文字列
     * @return メール認証トークン
     */
    Optional<EmailVerificationToken> findByToken(String token);

    /**
     * ユーザーIDからメール認証トークンを検索
     *
     * @param userId ユーザーID
     * @return メール認証トークン
     */
    Optional<EmailVerificationToken> findByUserId(Long userId);

    /**
     * ユーザーIDに紐づくトークンを削除
     *
     * @param userId ユーザーID
     */
    void deleteByUserId(Long userId);

    /**
     * 指定日時より前に期限切れのトークンを削除
     * @param now 現在日時
     */
    void deleteByExpiryDateBefore(java.util.Date now);
}
