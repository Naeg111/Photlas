package com.photlas.backend.dto;

import com.photlas.backend.entity.OAuthProvider;

import java.time.LocalDateTime;

/**
 * Issue#81 Phase 3b - OAuth プロバイダから取得した正規化済みユーザー情報。
 *
 * Spring Security の {@code OAuth2User} は Google / LINE それぞれで属性キーが異なるため、
 * {@code CustomOAuth2UserService} でこの共通 DTO に正規化してから
 * {@code OAuth2UserServiceHelper#processOAuthUser} に渡す。
 *
 * @param provider           OAuth プロバイダ
 * @param providerUserId     プロバイダ側のユーザー ID（Google の sub、LINE の userId）
 * @param email              プロバイダから取得したメールアドレス（検証済み想定）
 * @param accessToken        プロバイダ発行のアクセストークン（revoke 用、null 可）
 * @param tokenExpiresAt     アクセストークンの有効期限（null 可）
 * @param language           フロントから送られた言語コード（LanguageValidator で正規化前、null 可）
 */
public record OAuth2UserInfo(
        OAuthProvider provider,
        String providerUserId,
        String email,
        String accessToken,
        LocalDateTime tokenExpiresAt,
        String language
) {
    /**
     * 言語コード・アクセストークンなし版の簡易コンストラクタ（テスト用）。
     */
    public OAuth2UserInfo(OAuthProvider provider, String providerUserId, String email) {
        this(provider, providerUserId, email, null, null, null);
    }
}
