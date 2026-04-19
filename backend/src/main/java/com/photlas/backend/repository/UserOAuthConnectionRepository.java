package com.photlas.backend.repository;

import com.photlas.backend.entity.UserOAuthConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Issue#81 Phase 2 - UserOAuthConnection リポジトリ。
 *
 * 要件:
 *   - user_id で連携一覧を取得
 *   - (provider_code, provider_user_id) で単一連携を取得（OAuth ログイン時の検索）
 *   - user_id で削除（退会時のクリーンアップ用）
 */
@Repository
public interface UserOAuthConnectionRepository extends JpaRepository<UserOAuthConnection, Long> {

    /**
     * ユーザー ID で OAuth 連携の一覧を取得する。
     *
     * @param userId ユーザー ID
     * @return 連携の一覧（最大 2 件: Google / LINE）
     */
    List<UserOAuthConnection> findByUserId(Long userId);

    /**
     * プロバイダコードとプロバイダ側ユーザー ID で単一連携を取得する。
     * OAuth ログイン時、プロバイダが返した sub / uid から Photlas ユーザーを特定する。
     *
     * @param providerCode  OAuthProvider の数値コード（1401/1402）
     * @param providerUserId プロバイダ側のユーザー ID（Google の sub、LINE の userId）
     * @return 連携情報（なければ空）
     */
    Optional<UserOAuthConnection> findByProviderCodeAndProviderUserId(Integer providerCode, String providerUserId);

    /**
     * ユーザー ID に紐づく全 OAuth 連携を削除する。退会時のクリーンアップ用。
     *
     * @param userId ユーザー ID
     */
    @Modifying
    @Query("DELETE FROM UserOAuthConnection c WHERE c.userId = :userId")
    void deleteByUserId(Long userId);
}
