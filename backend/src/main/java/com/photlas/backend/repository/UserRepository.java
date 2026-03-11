package com.photlas.backend.repository;

import com.photlas.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * ユーザーリポジトリ
 * ユーザー情報のデータアクセスを提供します。
 */
@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * メールアドレスでユーザーを検索
     *
     * @param email メールアドレス
     * @return ユーザー（存在しない場合はOptional.empty()）
     */
    Optional<User> findByEmail(String email);

    /**
     * メールアドレスの存在チェック
     *
     * @param email メールアドレス
     * @return メールアドレスが既に存在する場合true
     */
    boolean existsByEmail(String email);

    /**
     * ユーザー名でユーザーを検索
     *
     * @param username ユーザー名
     * @return ユーザー（存在しない場合はOptional.empty()）
     */
    Optional<User> findByUsername(String username);

    /**
     * Issue#54: プロフィール画像S3キーでユーザーを検索
     *
     * @param profileImageS3Key プロフィール画像のS3オブジェクトキー
     * @return ユーザー（存在しない場合はOptional.empty()）
     */
    Optional<User> findByProfileImageS3Key(String profileImageS3Key);
}