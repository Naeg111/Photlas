package com.photlas.backend.dto;

import com.photlas.backend.entity.OAuthProvider;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Issue#81 Phase 4h - ユーザーの OAuth 連携一覧レスポンス。
 *
 * <p>{@code GET /api/v1/users/me/oauth-connections} のレスポンス。
 * email / providerUserId などの PII はクライアントに返さず、連携の有無と基本情報のみ。
 */
public record OAuthConnectionResponse(List<Connection> connections) {

    public record Connection(
            String provider,
            LocalDateTime createdAt
    ) {
        public static Connection of(OAuthProvider provider, LocalDateTime createdAt) {
            return new Connection(provider.name(), createdAt);
        }
    }
}
