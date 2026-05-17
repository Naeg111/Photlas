-- Issue#141 後追い (#4): 植物カテゴリの精査結果を反映する整理マイグレーション。
--
-- 内容:
--   1. ぶどう畑 (vineyard) を植物 (206) → その他 (214) へ移動
--   2. 改名:
--      - plant → 植物全般
--      - cherry-blossom: 桜 → サクラ
--      - hydrangea: 紫陽花 → アジサイ
--   3. 削除 (12 件):
--      - maple (もみじ): 「紅葉」(foliage) に含める意図で tag 削除
--      - vegetation/tree/leaf/grass/lawn/petal/moss/bush/fern/blossom/bamboo の 11 件
--   4. 並び順 (sort_order):
--      植物全般→サクラ→紅葉→ひまわり→チューリップ→バラ→アジサイ→ラベンダー
--      →蘭→百合→サボテン→キノコ→松→庭園

-- ========================================================================
-- 1. 削除 (子テーブル → 親 の順)
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (
  SELECT id FROM tags WHERE slug IN (
    'maple',
    'vegetation', 'tree', 'leaf', 'grass', 'lawn', 'petal',
    'moss', 'bush', 'fern', 'blossom', 'bamboo'
  )
);
DELETE FROM tag_categories WHERE tag_id IN (
  SELECT id FROM tags WHERE slug IN (
    'maple',
    'vegetation', 'tree', 'leaf', 'grass', 'lawn', 'petal',
    'moss', 'bush', 'fern', 'blossom', 'bamboo'
  )
);
DELETE FROM tags WHERE slug IN (
  'maple',
  'vegetation', 'tree', 'leaf', 'grass', 'lawn', 'petal',
  'moss', 'bush', 'fern', 'blossom', 'bamboo'
);

-- ========================================================================
-- 2. ぶどう畑 (vineyard) を植物 (206) → その他 (214) へ移動
-- ========================================================================
DELETE FROM tag_categories
WHERE tag_id = (SELECT id FROM tags WHERE slug = 'vineyard')
  AND category_code = 206;

INSERT INTO tag_categories (tag_id, category_code)
SELECT id, 214 FROM tags WHERE slug = 'vineyard';

-- ========================================================================
-- 3. 改名 + sort_order 設定
-- ========================================================================
-- 植物全般
UPDATE tags SET
  display_name_ja = '植物全般',
  display_name_en = 'Plant (general)',
  display_name_zh = '植物总览',
  display_name_ko = '식물 일반',
  display_name_es = 'Planta en general',
  sort_order = 10
WHERE slug = 'plant';

-- 桜 → サクラ (日本語のみ。他言語は維持)
UPDATE tags SET display_name_ja = 'サクラ', sort_order = 20 WHERE slug = 'cherry-blossom';

-- 紅葉 (foliage)
UPDATE tags SET sort_order = 30 WHERE slug = 'foliage';

-- ひまわり
UPDATE tags SET sort_order = 40 WHERE slug = 'sunflower';

-- チューリップ
UPDATE tags SET sort_order = 50 WHERE slug = 'tulip';

-- バラ
UPDATE tags SET sort_order = 60 WHERE slug = 'rose';

-- 紫陽花 → アジサイ
UPDATE tags SET display_name_ja = 'アジサイ', sort_order = 70 WHERE slug = 'hydrangea';

-- ラベンダー
UPDATE tags SET sort_order = 80 WHERE slug = 'lavender';

-- 蘭
UPDATE tags SET sort_order = 90 WHERE slug = 'orchid';

-- 百合
UPDATE tags SET sort_order = 100 WHERE slug = 'lily';

-- サボテン
UPDATE tags SET sort_order = 110 WHERE slug = 'cactus';

-- キノコ
UPDATE tags SET sort_order = 120 WHERE slug = 'mushroom';

-- 松
UPDATE tags SET sort_order = 130 WHERE slug = 'pine';

-- 庭園
UPDATE tags SET sort_order = 140 WHERE slug = 'garden';
