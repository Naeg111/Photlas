-- V001: パフォーマンス最適化のためのインデックス追加
-- 本番環境では ddl-auto=validate のため、このSQLを手動実行する必要がある

-- photos テーブル
CREATE INDEX IF NOT EXISTS idx_photos_spot_id ON photos(spot_id);
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at);

-- spots テーブル
CREATE INDEX IF NOT EXISTS idx_spots_lat_lng ON spots(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_spots_created_by ON spots(created_by_user_id);

-- favorites テーブル（複合PKがuser_id, photo_idだが、photo_id単体の検索用）
CREATE INDEX IF NOT EXISTS idx_favorites_photo_id ON favorites(photo_id);

-- reports テーブル（複合PKがreporting_user_id, photo_idだが、photo_id単体の検索用）
CREATE INDEX IF NOT EXISTS idx_reports_photo_id ON reports(photo_id);
