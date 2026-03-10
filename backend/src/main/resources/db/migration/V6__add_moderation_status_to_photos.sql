-- Issue#54: 投稿にモデレーションステータスを追加
-- PENDING_REVIEW: 審査待ち, PUBLISHED: 公開中, QUARANTINED: 隔離中, REMOVED: 違反確定
ALTER TABLE photos ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED';

-- 既存の投稿は全てPUBLISHEDステータスに設定（マイグレーション完了後のデフォルト値はPENDING_REVIEW）
-- 新規投稿はアプリケーション側でPENDING_REVIEWを設定する

-- インデックスを追加（ステータスによるフィルタリングを高速化）
CREATE INDEX IF NOT EXISTS idx_photos_moderation_status ON photos(moderation_status);
