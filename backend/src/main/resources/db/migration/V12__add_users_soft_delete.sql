-- Issue#72: ソフトデリート対応
-- ユーザー退会時にdeleted_atを設定して論理削除する。90日後にバッチ処理で物理削除する。
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN original_username VARCHAR(12) DEFAULT NULL;
CREATE INDEX idx_users_deleted_at ON users(deleted_at);
