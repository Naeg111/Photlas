-- V22: users テーブルの OAuth 対応（Issue#81）
--
-- 変更内容:
--   1. password_hash を NULLABLE 化（OAuth のみユーザーはパスワード無し）
--   2. username_temporary カラム追加（仮ユーザー名フラグ、初回 OAuth ログイン時は true）
--   3. password_recommendation_dismissed_at カラム追加（バナー却下時刻、7 日間非表示制御用）

ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
    ADD COLUMN username_temporary BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE users
    ADD COLUMN password_recommendation_dismissed_at TIMESTAMP;

-- 既存ユーザーは全員 username_temporary=false（通常登録経路でユーザー名確定済み）
-- → デフォルト値 FALSE で既に担保されているが、明示的に再確認
-- （新規カラムなので既存行には DEFAULT が自動適用される）
