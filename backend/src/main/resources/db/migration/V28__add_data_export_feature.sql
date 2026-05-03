-- Issue#108: ユーザー向けデータエクスポート機能（データポータビリティ対応）
-- 1) users テーブルへ最終エクスポート日時 / 同時実行制御フラグを追加
-- 2) data_export_log テーブルを新設（監査ログ・履歴・障害調査用）

ALTER TABLE users
    ADD COLUMN last_exported_at TIMESTAMP,
    ADD COLUMN export_in_progress_at TIMESTAMP;

CREATE TABLE data_export_log (
    id                    BIGSERIAL PRIMARY KEY,
    user_id               BIGINT       NOT NULL REFERENCES users(id),
    requested_at          TIMESTAMP    NOT NULL,
    completed_at          TIMESTAMP,
    status                VARCHAR(20)  NOT NULL,
    photo_count           INT,
    estimated_size_bytes  BIGINT,
    failure_reason        VARCHAR(1000),
    request_ip            VARCHAR(45),
    user_agent            VARCHAR(1000)
);

CREATE INDEX idx_data_export_log_user_id      ON data_export_log(user_id);
CREATE INDEX idx_data_export_log_requested_at ON data_export_log(requested_at);
