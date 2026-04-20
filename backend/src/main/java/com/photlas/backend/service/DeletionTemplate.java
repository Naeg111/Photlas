package com.photlas.backend.service;

/**
 * Issue#81 Phase 4d - 退会完了メールのテンプレート区分（Round 12 / Q13 / [4-B]）。
 *
 * <p>退会ユーザーのアカウント構成に応じて復旧経路の案内文面を変える:
 * <ul>
 *   <li>{@link #NORMAL}: password_hash != null かつ OAuth 連携なし
 *       → 「メールアドレスとパスワードでログイン」で復旧</li>
 *   <li>{@link #HYBRID}: password_hash != null かつ OAuth 連携あり
 *       → 「メールアドレスとパスワード、または {provider} でサインイン」</li>
 *   <li>{@link #OAUTH_ONLY}: password_hash == null（OAuth 連携前提）
 *       → 「{provider} で再度サインイン」</li>
 * </ul>
 */
public enum DeletionTemplate {
    NORMAL,
    HYBRID,
    OAUTH_ONLY
}
