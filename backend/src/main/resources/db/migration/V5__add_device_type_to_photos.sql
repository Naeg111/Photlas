-- Issue#46: 機材種別カラムを追加
-- 投稿時にユーザーが選択した機材種別を保存する
-- 値: SLR, MIRRORLESS, COMPACT, SMARTPHONE, FILM, OTHER
ALTER TABLE photos ADD COLUMN device_type VARCHAR(20);

-- 既存データのマイグレーション: camera_bodyからスマートフォンを自動判定
UPDATE photos SET device_type = 'SMARTPHONE'
WHERE camera_body IS NOT NULL AND (
    LOWER(camera_body) LIKE '%apple%'
    OR LOWER(camera_body) LIKE '%iphone%'
    OR LOWER(camera_body) LIKE '%samsung%'
    OR LOWER(camera_body) LIKE '%google%'
    OR LOWER(camera_body) LIKE '%pixel%'
    OR LOWER(camera_body) LIKE '%huawei%'
    OR LOWER(camera_body) LIKE '%xiaomi%'
    OR LOWER(camera_body) LIKE '%oppo%'
    OR LOWER(camera_body) LIKE '%oneplus%'
    OR LOWER(camera_body) LIKE '%sony xperia%'
);
