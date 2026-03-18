-- Issue#65: location_suggestionsテーブルの外部キーにON DELETE CASCADEを追加

-- 既存の外部キー制約を削除
ALTER TABLE location_suggestions DROP CONSTRAINT IF EXISTS location_suggestions_photo_id_fkey;
ALTER TABLE location_suggestions DROP CONSTRAINT IF EXISTS location_suggestions_suggester_id_fkey;

-- ON DELETE CASCADE付きで外部キー制約を再作成
ALTER TABLE location_suggestions
    ADD CONSTRAINT location_suggestions_photo_id_fkey
    FOREIGN KEY (photo_id) REFERENCES photos(photo_id) ON DELETE CASCADE;

ALTER TABLE location_suggestions
    ADD CONSTRAINT location_suggestions_suggester_id_fkey
    FOREIGN KEY (suggester_id) REFERENCES users(id) ON DELETE CASCADE;
