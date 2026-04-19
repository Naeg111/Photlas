-- V24: OAuth 関連テーブルへのインデックス追加（Issue#81）
--
-- V23 で UNIQUE 制約は付与済みだが、主要な参照パターンに応じた追加インデックスを設置する:
--   * user_id 単体での参照（UserOAuthConnectionRepository.findByUserId()）
--   * provider_code 単体での集計（運用モニタリング用の COUNT(*) GROUP BY provider_code）
--   * token_expires_at でのスキャン（将来バッチで失効トークン削除する際の範囲検索用）

CREATE INDEX idx_uoc_user_id
    ON user_oauth_connections (user_id);

CREATE INDEX idx_uoc_provider_code
    ON user_oauth_connections (provider_code);

CREATE INDEX idx_uoc_token_expires_at
    ON user_oauth_connections (token_expires_at)
    WHERE token_expires_at IS NOT NULL;

-- username_temporary=true のユーザーに対する検索（未確定ユーザー名の一覧取得用）
CREATE INDEX idx_users_username_temporary
    ON users (username_temporary)
    WHERE username_temporary = TRUE;
