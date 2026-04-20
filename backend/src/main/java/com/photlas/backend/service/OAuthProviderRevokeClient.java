package com.photlas.backend.service;

import com.photlas.backend.entity.OAuthProvider;

/**
 * Issue#81 Phase 4c - OAuth プロバイダ（Google / LINE）の revoke API 呼び出しを抽象化する境界インターフェース。
 *
 * <p>プロダクション実装は RestClient / HttpClient を使ってプロバイダに POST するが、
 * {@link OAuthTokenRevokeService} のユニットテストでは本インターフェースをモックし、
 * 実際のネットワーク呼び出しを行わずに logic を検証する。
 *
 * <p>実装は失敗時に例外を投げる。呼び出し元（{@link OAuthTokenRevokeService}）が
 * catch して best-effort として扱う。
 */
public interface OAuthProviderRevokeClient {

    /**
     * 指定プロバイダの revoke エンドポイントへ access_token を送信する。
     *
     * @param provider    対象プロバイダ（GOOGLE / LINE）
     * @param accessToken 復号済み access_token
     * @throws RuntimeException revoke API 呼び出しが失敗した場合（HTTP 4xx/5xx / タイムアウトなど）
     */
    void revoke(OAuthProvider provider, String accessToken);
}
