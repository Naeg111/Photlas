package com.photlas.backend.dto;

/**
 * Issue#81 Phase 4f - パスワード推奨バナー API のレスポンス DTO。
 *
 * <p>{@code shouldRecommend=true} のとき、フロントエンドは「パスワード設定を推奨します」
 * バナーを表示する。{@code provider} はバナー文言の {@code {{provider}}} プレースホルダ
 * 置換用（"GOOGLE" または "LINE"）。
 *
 * <p>推奨条件（Round 12 / Q8 / [2-G]）:
 * <ul>
 *   <li>{@code usernameTemporary == false}（ユーザー名確定済み）</li>
 *   <li>{@code password_hash IS NULL}（OAuth のみユーザー）</li>
 *   <li>{@code password_recommendation_dismissed_at IS NULL}
 *       OR {@code dismissed_at + 7 days < NOW()}</li>
 * </ul>
 */
public record PasswordRecommendationResponse(boolean shouldRecommend, String provider) {
}
