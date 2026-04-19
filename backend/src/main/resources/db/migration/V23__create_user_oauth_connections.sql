-- V23: user_oauth_connections テーブル新規作成（Issue#81）
--
-- OAuth プロバイダー（Google / LINE）との連携情報を管理する。
-- 1 アカウント 1 プロバイダ制限（Q5 決定、UNIQUE(user_id, provider_code)）。
-- access_token は AES-256-GCM で暗号化して保存し、退会時の best-effort revoke に利用する（Q9 決定）。
--
-- provider_code: Issue#81 三次精査 [2-A] で CodeConstants の衝突回避のため 1401/1402 に変更
--   1401 = GOOGLE
--   1402 = LINE

CREATE TABLE user_oauth_connections (
    id                       BIGSERIAL PRIMARY KEY,
    user_id                  BIGINT       NOT NULL,
    provider_code            SMALLINT     NOT NULL,
    provider_user_id         VARCHAR(255) NOT NULL,
    email                    VARCHAR(255),
    email_verified           BOOLEAN,
    access_token_encrypted   BYTEA,
    token_encrypted_iv       BYTEA,
    token_expires_at         TIMESTAMP,
    created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_uoc_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_uoc_user_provider
        UNIQUE (user_id, provider_code),
    CONSTRAINT uq_uoc_provider_user
        UNIQUE (provider_code, provider_user_id),
    CONSTRAINT chk_uoc_provider_code
        CHECK (provider_code IN (1401, 1402))
);

COMMENT ON TABLE user_oauth_connections IS
    'OAuth プロバイダ連携情報（Issue#81）。1 ユーザー 1 プロバイダ制限、access_token は AES-256-GCM で暗号化。';
COMMENT ON COLUMN user_oauth_connections.provider_code IS
    'プロバイダ識別コード（1401=GOOGLE, 1402=LINE）。CodeConstants と整合する。';
COMMENT ON COLUMN user_oauth_connections.access_token_encrypted IS
    'OAuth access_token の AES-256-GCM 暗号化バイト列。退会時の revoke で復号して送信。';
COMMENT ON COLUMN user_oauth_connections.token_encrypted_iv IS
    'AES-256-GCM の初期化ベクトル（12 バイト）。access_token_encrypted と対で管理。';
COMMENT ON COLUMN user_oauth_connections.token_expires_at IS
    'OAuth access_token の有効期限。期限切れトークンは revoke をスキップする判定に使用。';
