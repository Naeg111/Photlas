-- Issue#141 後追い (#3): カテゴリ詳細の追加精査結果を反映する整理マイグレーション。
--
-- 内容:
--   1. 削除: astronomy, vehicle/sedan/convertible/taxi, wildlife/pet/mammal,
--           crow/goose/duck/seagull/pigeon/butterfly
--   2. 改名 (display_name):
--      - animal → 動物全般 / car → 自動車全般 / bird → 野鳥全般
--      - sheep→ヒツジ, pig→ブタ, horse→ウマ, goat→ヤギ, dog→イヌ,
--        cow→ウシ, cat→ネコ, eagle→ワシ, crane→ツル
--   3. tag_categories 振り分け (動物 ↔ 野鳥):
--      - bird: 207 削除 → 208 のみ
--      - swan/sparrow/kingfisher/heron/hawk/falcon/eagle/crane: 207 削除 → 208 のみ
--      - owl/peacock/flamingo/penguin: 208 削除 → 207 のみ
--   4. sort_order 設定:
--      - 動物 (207): 動物全般→イヌ→ネコ→…→クジラ→（wolf は末尾）
--      - 自動車 (209): 自動車全般→スポーツカー→SUV→ピックアップトラック→バス→トラック
--      - 野鳥 (208): 野鳥全般→白鳥→スズメ→…→ツル

-- ========================================================================
-- 1. 削除 (子テーブル → 親 の順)
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (
  SELECT id FROM tags WHERE slug IN (
    'astronomy',
    'vehicle', 'sedan', 'convertible', 'taxi',
    'wildlife', 'pet', 'mammal',
    'crow', 'goose', 'duck', 'seagull', 'pigeon', 'butterfly'
  )
);
DELETE FROM tag_categories WHERE tag_id IN (
  SELECT id FROM tags WHERE slug IN (
    'astronomy',
    'vehicle', 'sedan', 'convertible', 'taxi',
    'wildlife', 'pet', 'mammal',
    'crow', 'goose', 'duck', 'seagull', 'pigeon', 'butterfly'
  )
);
DELETE FROM tags WHERE slug IN (
  'astronomy',
  'vehicle', 'sedan', 'convertible', 'taxi',
  'wildlife', 'pet', 'mammal',
  'crow', 'goose', 'duck', 'seagull', 'pigeon', 'butterfly'
);

-- ========================================================================
-- 2. 改名 (display_name)
-- ========================================================================
-- 「動物全般」「自動車全般」「野鳥全般」
UPDATE tags SET
  display_name_ja = '動物全般',
  display_name_en = 'Animal (general)',
  display_name_zh = '动物总览',
  display_name_ko = '동물 일반',
  display_name_es = 'Animal en general',
  sort_order = 5
WHERE slug = 'animal';

UPDATE tags SET
  display_name_ja = '自動車全般',
  display_name_en = 'Car (general)',
  display_name_zh = '汽车总览',
  display_name_ko = '자동차 일반',
  display_name_es = 'Coche en general',
  sort_order = 10
WHERE slug = 'car';

UPDATE tags SET
  display_name_ja = '野鳥全般',
  display_name_en = 'Wild Bird (general)',
  display_name_zh = '野鸟总览',
  display_name_ko = '야생 조류 일반',
  display_name_es = 'Ave silvestre en general',
  sort_order = 10
WHERE slug = 'bird';

-- 動物の和名カナ化 (日本語のみ。他言語は維持)
UPDATE tags SET display_name_ja = 'ヒツジ' WHERE slug = 'sheep';
UPDATE tags SET display_name_ja = 'ブタ'   WHERE slug = 'pig';
UPDATE tags SET display_name_ja = 'ウマ'   WHERE slug = 'horse';
UPDATE tags SET display_name_ja = 'ヤギ'   WHERE slug = 'goat';
UPDATE tags SET display_name_ja = 'イヌ'   WHERE slug = 'dog';
UPDATE tags SET display_name_ja = 'ウシ'   WHERE slug = 'cow';
UPDATE tags SET display_name_ja = 'ネコ'   WHERE slug = 'cat';
UPDATE tags SET display_name_ja = 'ワシ'   WHERE slug = 'eagle';
UPDATE tags SET display_name_ja = 'ツル'   WHERE slug = 'crane';

-- ========================================================================
-- 3. tag_categories 振り分け
-- ========================================================================
-- 3.1 動物 (207) から削除 → 野鳥 (208) のみに残す
-- bird/swan/sparrow/kingfisher/heron/hawk/falcon/eagle/crane
DELETE FROM tag_categories
WHERE category_code = 207
  AND tag_id IN (SELECT id FROM tags WHERE slug IN (
    'bird', 'swan', 'sparrow', 'kingfisher', 'heron', 'hawk', 'falcon', 'eagle', 'crane'
  ));

-- 3.2 野鳥 (208) から削除 → 動物 (207) のみに残す
-- owl/peacock/flamingo/penguin
DELETE FROM tag_categories
WHERE category_code = 208
  AND tag_id IN (SELECT id FROM tags WHERE slug IN (
    'owl', 'peacock', 'flamingo', 'penguin'
  ));

-- ========================================================================
-- 4. sort_order 設定
-- ========================================================================
-- 動物 (207): 26 件 + wolf を末尾
UPDATE tags SET sort_order = 10  WHERE slug = 'dog';        -- イヌ
UPDATE tags SET sort_order = 20  WHERE slug = 'cat';        -- ネコ
UPDATE tags SET sort_order = 30  WHERE slug = 'panda';      -- パンダ
UPDATE tags SET sort_order = 40  WHERE slug = 'horse';      -- ウマ
UPDATE tags SET sort_order = 50  WHERE slug = 'elephant';   -- ゾウ
UPDATE tags SET sort_order = 60  WHERE slug = 'giraffe';    -- キリン
UPDATE tags SET sort_order = 70  WHERE slug = 'lion';       -- ライオン
UPDATE tags SET sort_order = 80  WHERE slug = 'tiger';      -- トラ
UPDATE tags SET sort_order = 90  WHERE slug = 'leopard';    -- ヒョウ
UPDATE tags SET sort_order = 100 WHERE slug = 'zebra';      -- シマウマ
UPDATE tags SET sort_order = 110 WHERE slug = 'rabbit';     -- ウサギ
UPDATE tags SET sort_order = 120 WHERE slug = 'fox';        -- キツネ
UPDATE tags SET sort_order = 130 WHERE slug = 'monkey';     -- サル
UPDATE tags SET sort_order = 140 WHERE slug = 'owl';        -- フクロウ
UPDATE tags SET sort_order = 150 WHERE slug = 'sheep';      -- ヒツジ
UPDATE tags SET sort_order = 160 WHERE slug = 'goat';       -- ヤギ
UPDATE tags SET sort_order = 170 WHERE slug = 'squirrel';   -- リス
UPDATE tags SET sort_order = 180 WHERE slug = 'bear';       -- クマ
UPDATE tags SET sort_order = 190 WHERE slug = 'cow';        -- ウシ
UPDATE tags SET sort_order = 200 WHERE slug = 'pig';        -- ブタ
UPDATE tags SET sort_order = 210 WHERE slug = 'deer';       -- シカ
UPDATE tags SET sort_order = 220 WHERE slug = 'peacock';    -- クジャク
UPDATE tags SET sort_order = 230 WHERE slug = 'flamingo';   -- フラミンゴ
UPDATE tags SET sort_order = 240 WHERE slug = 'dolphin';    -- イルカ
UPDATE tags SET sort_order = 250 WHERE slug = 'penguin';    -- ペンギン
UPDATE tags SET sort_order = 260 WHERE slug = 'whale';      -- クジラ
UPDATE tags SET sort_order = 1000 WHERE slug = 'wolf';      -- オオカミ (末尾)

-- 自動車 (209): 自動車全般→スポーツカー→SUV→ピックアップトラック→バス→トラック
UPDATE tags SET sort_order = 20 WHERE slug = 'sports-car';   -- スポーツカー
UPDATE tags SET sort_order = 30 WHERE slug = 'suv';          -- SUV
UPDATE tags SET sort_order = 40 WHERE slug = 'pickup-truck'; -- ピックアップトラック
UPDATE tags SET sort_order = 50 WHERE slug = 'bus';          -- バス
UPDATE tags SET sort_order = 60 WHERE slug = 'truck';        -- トラック

-- 野鳥 (208): 野鳥全般→白鳥→スズメ→カワセミ→サギ→タカ→ハヤブサ→ワシ→ツル
UPDATE tags SET sort_order = 20 WHERE slug = 'swan';        -- 白鳥
UPDATE tags SET sort_order = 30 WHERE slug = 'sparrow';     -- スズメ
UPDATE tags SET sort_order = 40 WHERE slug = 'kingfisher';  -- カワセミ
UPDATE tags SET sort_order = 50 WHERE slug = 'heron';       -- サギ
UPDATE tags SET sort_order = 60 WHERE slug = 'hawk';        -- タカ
UPDATE tags SET sort_order = 70 WHERE slug = 'falcon';      -- ハヤブサ
UPDATE tags SET sort_order = 80 WHERE slug = 'eagle';       -- ワシ
UPDATE tags SET sort_order = 90 WHERE slug = 'crane';       -- ツル
