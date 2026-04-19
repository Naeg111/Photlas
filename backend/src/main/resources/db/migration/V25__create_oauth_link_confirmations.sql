-- V25: oauth_link_confirmations テーブル新規作成（Issue#81）
--
-- 既存のパスワードアカウントに OAuth 連携を追加する際、ユーザーに確認させるための
-- 短命トークンを管理する（Q1 決定、TTL 5 分、DB で管理）。
--
-- フロー:
--   1. 既存アカウント（email 一致）を検出したら、本テーブルに確認トークンを発行
--   2. フロントに token を返却、LinkAccountConfirmDialog で確認
--   3. ユーザー承認 → POST /api/v1/auth/oauth2/confirm-link で token を消費
--   4. 消費後は consumed_at を設定、再利用不可

CREATE TABLE oauth_link_confirmations (
    id                    BIGSERIAL PRIMARY KEY,
    token_hash            CHAR(64)     NOT NULL UNIQUE,
    user_id               BIGINT       NOT NULL,
    provider_code         SMALLINT     NOT NULL,
    provider_user_id      VARCHAR(255) NOT NULL,
    provider_email        VARCHAR(255),
    expires_at            TIMESTAMP    NOT NULL,
    consumed_at           TIMESTAMP,
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_olc_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_olc_provider_code
        CHECK (provider_code IN (1401, 1402))
);

-- 消費前のトークンを TTL で検索するためのインデックス
CREATE INDEX idx_olc_expires_consumed
    ON oauth_link_confirmations (expires_at, consumed_at);

-- ユーザーごとの発行履歴を追うためのインデックス（将来、連打検知で使用）
CREATE INDEX idx_olc_user_id
    ON oauth_link_confirmations (user_id);

COMMENT ON TABLE oauth_link_confirmations IS
    'OAuth アカウントリンク確認トークン（Issue#81 Q1）。TTL 5 分、一度消費したら再利用不可。';
COMMENT ON COLUMN oauth_link_confirmations.token_hash IS
    'クライアントに返す生トークンの SHA-256 ハッシュ（hex 64 文字）。DB には生値を保存しない。';
COMMENT ON COLUMN oauth_link_confirmations.expires_at IS
    'トークンの有効期限（発行時刻 + 5 分）。過ぎたら consume() で拒否する。';
COMMENT ON COLUMN oauth_link_confirmations.consumed_at IS
    'リンク確立に使用した時刻。NULL なら未消費、非 NULL なら消費済み（再利用不可）。';
