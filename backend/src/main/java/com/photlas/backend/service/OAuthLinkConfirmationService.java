package com.photlas.backend.service;

import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.repository.OAuthLinkConfirmationRepository;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;

/**
 * Issue#81 Phase 4g - OAuth アカウントリンク確認サービス（Q1）。
 *
 * <p>既存パスワードアカウントと OAuth 連携を結ぶ前に、ユーザーに明示確認させるための
 * 短命トークン（TTL 5 分）を発行・消費する。Red 段階のスタブ。
 */
public class OAuthLinkConfirmationService {

    /** トークン TTL（発行から 5 分）。 */
    static final int TOKEN_TTL_MINUTES = 5;

    private final OAuthLinkConfirmationRepository repository;
    private final UserRepository userRepository;
    private final UserOAuthConnectionRepository userOAuthConnectionRepository;

    public OAuthLinkConfirmationService(
            OAuthLinkConfirmationRepository repository,
            UserRepository userRepository,
            UserOAuthConnectionRepository userOAuthConnectionRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.userOAuthConnectionRepository = userOAuthConnectionRepository;
    }

    /**
     * リンク確認トークンを発行する。
     *
     * @param userId         対象ユーザー ID（既存パスワードアカウント）
     * @param provider       連携するプロバイダ
     * @param providerUserId プロバイダ側のユーザー ID
     * @param providerEmail  プロバイダから取得した email
     * @return クライアントに返却する生トークン（hex 64 文字）
     */
    public String issue(Long userId, OAuthProvider provider, String providerUserId, String providerEmail) {
        throw new UnsupportedOperationException("Phase 4g Green で実装する");
    }

    /**
     * リンク確認トークンを消費し、UserOAuthConnection を作成する。
     *
     * @param rawToken クライアントから送られた生トークン
     * @return リンクされた User
     * @throws IllegalArgumentException トークンが無効・期限切れ・消費済み・ユーザー削除済みの場合
     */
    public User consume(String rawToken) {
        throw new UnsupportedOperationException("Phase 4g Green で実装する");
    }
}
