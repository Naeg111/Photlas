package com.photlas.backend.repository;

import com.photlas.backend.entity.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * パスワードリセットトークンのリポジトリ
 * Issue#6: パスワードリセット機能
 */
@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    /**
     * ユーザーIDからパスワードリセットトークンを検索
     * @param userId ユーザーID
     * @return パスワードリセットトークン
     */
    Optional<PasswordResetToken> findByUserId(Long userId);

    /**
     * トークン文字列からパスワードリセットトークンを検索
     * @param token トークン文字列
     * @return パスワードリセットトークン
     */
    Optional<PasswordResetToken> findByToken(String token);
}
