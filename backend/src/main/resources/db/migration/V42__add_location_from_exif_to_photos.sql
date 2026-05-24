-- Issue#146: 撮影場所が写真の EXIF GPS 由来かどうかを記録する。
-- true の場合、撮影場所指摘は元の場所から 1km 以内に制限される（GPS 写真は位置がおおむね正しいため）。
-- 既存写真は GPS 由来情報を復元できないため、すべて false（GPS なし扱い・指摘上限なし）とする。
ALTER TABLE photos
    ADD COLUMN location_from_exif BOOLEAN NOT NULL DEFAULT FALSE;
