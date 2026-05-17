-- Issue#141 後追い (#2): キーワードの精査結果を反映する整理マイグレーション。
--
-- 内容:
--   1. 削除: V37 で追加した「太陽」(sun)、重複/不要 (aircraft=航空機, train=列車)
--   2. 改名: airplane→「飛行機全般」, railway→「鉄道全般」, motorcycle→「バイク全般」
--   3. 並び順:
--      - 飛行機 (212): 飛行機全般 → 旅客機 → ヘリコプター → グライダー → ジェット機 → ドローン → 熱気球
--      - 鉄道 (211): 鉄道全般 → 新幹線 → 機関車 → 路面電車 → ケーブルカー → モノレール → 地下鉄
--      - バイク (210): バイク全般 → スクーター → モペッド
--   4. 「駅」(train-station) を 211 (鉄道) → 203 (建造物) に移動

-- ========================================================================
-- 1. 削除 (子テーブル → 親 の順)
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (
  SELECT id FROM tags WHERE slug IN ('sun', 'aircraft', 'train')
);
DELETE FROM tag_categories WHERE tag_id IN (
  SELECT id FROM tags WHERE slug IN ('sun', 'aircraft', 'train')
);
DELETE FROM tags WHERE slug IN ('sun', 'aircraft', 'train');

-- ========================================================================
-- 2. 改名 (「〜全般」化)
-- ========================================================================
UPDATE tags SET
  display_name_ja = '飛行機全般',
  display_name_en = 'Airplane (general)',
  display_name_zh = '飞机总览',
  display_name_ko = '비행기 일반',
  display_name_es = 'Avión en general',
  sort_order = 10
WHERE slug = 'airplane';

UPDATE tags SET
  display_name_ja = '鉄道全般',
  display_name_en = 'Railway (general)',
  display_name_zh = '铁路总览',
  display_name_ko = '철도 일반',
  display_name_es = 'Ferrocarril en general',
  sort_order = 10
WHERE slug = 'railway';

UPDATE tags SET
  display_name_ja = 'バイク全般',
  display_name_en = 'Motorcycle (general)',
  display_name_zh = '摩托车总览',
  display_name_ko = '오토바이 일반',
  display_name_es = 'Motocicleta en general',
  sort_order = 10
WHERE slug = 'motorcycle';

-- ========================================================================
-- 3. 並び順 (sort_order)
-- ========================================================================
-- 飛行機 (212)
UPDATE tags SET sort_order = 20 WHERE slug = 'airliner';        -- 旅客機
UPDATE tags SET sort_order = 30 WHERE slug = 'helicopter';      -- ヘリコプター
UPDATE tags SET sort_order = 40 WHERE slug = 'glider';          -- グライダー
UPDATE tags SET sort_order = 50 WHERE slug = 'jet';             -- ジェット機
UPDATE tags SET sort_order = 60 WHERE slug = 'drone';           -- ドローン
UPDATE tags SET sort_order = 70 WHERE slug = 'hot-air-balloon'; -- 熱気球

-- 鉄道 (211)
UPDATE tags SET sort_order = 20 WHERE slug = 'bullet-train';    -- 新幹線
UPDATE tags SET sort_order = 30 WHERE slug = 'locomotive';      -- 機関車
UPDATE tags SET sort_order = 40 WHERE slug = 'tram';            -- 路面電車
UPDATE tags SET sort_order = 50 WHERE slug = 'cable-car';       -- ケーブルカー
UPDATE tags SET sort_order = 60 WHERE slug = 'monorail';        -- モノレール
UPDATE tags SET sort_order = 70 WHERE slug = 'subway';          -- 地下鉄

-- バイク (210)
UPDATE tags SET sort_order = 20 WHERE slug = 'scooter';         -- スクーター
UPDATE tags SET sort_order = 30 WHERE slug = 'moped';           -- モペッド

-- ========================================================================
-- 4. 「駅」を 211 (鉄道) → 203 (建造物) に移動
-- ========================================================================
DELETE FROM tag_categories
WHERE tag_id = (SELECT id FROM tags WHERE slug = 'train-station')
  AND category_code = 211;

INSERT INTO tag_categories (tag_id, category_code)
SELECT id, 203 FROM tags WHERE slug = 'train-station';
