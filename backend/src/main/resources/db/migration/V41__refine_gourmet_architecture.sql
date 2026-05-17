-- Issue#141 後追い (#5): グルメ・建造物カテゴリの精査結果を反映する整理マイグレーション。
--
-- 内容:
--   【グルメ (205)】
--     - 改名: food → グルメ全般
--     - 削除: cuisine (料理) / breakfast (朝食) / beverage (飲み物)
--             → 「グルメ全般」に含める意図で tag 削除 (CategoryDictionary 維持)
--             vegetable (野菜) / soup (スープ) / noodle (麺) → 完全削除
--     - 追加: udon (うどん) / soba (そば)
--     - 並び順: グルメ全般→カフェ→レストラン→ベーカリー→ラーメン→寿司→海鮮→
--             バーガー→カレー→パスタ→うどん→そば→ピザ→ステーキ→パン→
--             サンドイッチ→サラダ→デザート→ケーキ→ドーナツ→パンケーキ→
--             アイスクリーム→チョコレート→チーズ→クッキー→コーヒー→
--             ワイン→ビール→カクテル→お茶→果物
--
--   【建造物 (203)】
--     - 改名: building → 建造物全般
--     - 削除: architecture (建築) / torii (鳥居)
--             → architecture は「建造物全般」、torii は「神社/寺」に含める意図
--                (CategoryDictionary 維持)
--     - 並び順: 建造物全般→城→塔→ダム→大聖堂→教会→ピラミッド→モスク→
--             要塞→寺→神社→灯台→駅→ホテル→高層ビル→アリーナ→
--             スタジアム→トンネル→門→記念碑
--     - 並び順リスト外 (bridge / pagoda / pier / pavilion) は末尾

-- ========================================================================
-- 1. 削除 (子テーブル → 親 の順)
-- ========================================================================
DELETE FROM photo_tags WHERE tag_id IN (
  SELECT id FROM tags WHERE slug IN (
    'cuisine', 'breakfast', 'beverage',
    'vegetable', 'soup', 'noodle',
    'architecture', 'torii'
  )
);
DELETE FROM tag_categories WHERE tag_id IN (
  SELECT id FROM tags WHERE slug IN (
    'cuisine', 'breakfast', 'beverage',
    'vegetable', 'soup', 'noodle',
    'architecture', 'torii'
  )
);
DELETE FROM tags WHERE slug IN (
  'cuisine', 'breakfast', 'beverage',
  'vegetable', 'soup', 'noodle',
  'architecture', 'torii'
);

-- ========================================================================
-- 2. 新規 tag 追加 (うどん / そば)
-- ========================================================================
INSERT INTO tags
  (rekognition_label, slug, display_name_ja, display_name_en, display_name_zh, display_name_ko, display_name_es, sort_order)
VALUES
  ('Udon', 'udon', 'うどん', 'Udon', '乌冬面', '우동', 'Udon', 110),
  ('Soba', 'soba', 'そば', 'Soba', '荞麦面', '소바', 'Soba', 120);

INSERT INTO tag_categories (tag_id, category_code)
SELECT id, 205 FROM tags WHERE slug IN ('udon', 'soba');

-- ========================================================================
-- 3. 改名 + sort_order 設定
-- ========================================================================

-- グルメ (205)
UPDATE tags SET
  display_name_ja = 'グルメ全般',
  display_name_en = 'Gourmet (general)',
  display_name_zh = '美食总览',
  display_name_ko = '음식 일반',
  display_name_es = 'Gourmet en general',
  sort_order = 10
WHERE slug = 'food';

UPDATE tags SET sort_order = 20  WHERE slug = 'cafe';        -- カフェ
UPDATE tags SET sort_order = 30  WHERE slug = 'restaurant';  -- レストラン
UPDATE tags SET sort_order = 40  WHERE slug = 'bakery';      -- ベーカリー
UPDATE tags SET sort_order = 50  WHERE slug = 'ramen';       -- ラーメン
UPDATE tags SET sort_order = 60  WHERE slug = 'sushi';       -- 寿司
UPDATE tags SET sort_order = 70  WHERE slug = 'seafood';     -- 海鮮
UPDATE tags SET sort_order = 80  WHERE slug = 'burger';      -- バーガー
UPDATE tags SET sort_order = 90  WHERE slug = 'curry';       -- カレー
UPDATE tags SET sort_order = 100 WHERE slug = 'pasta';       -- パスタ
-- udon=110, soba=120 は INSERT で設定済
UPDATE tags SET sort_order = 130 WHERE slug = 'pizza';       -- ピザ
UPDATE tags SET sort_order = 140 WHERE slug = 'steak';       -- ステーキ
UPDATE tags SET sort_order = 150 WHERE slug = 'bread';       -- パン
UPDATE tags SET sort_order = 160 WHERE slug = 'sandwich';    -- サンドイッチ
UPDATE tags SET sort_order = 170 WHERE slug = 'salad';       -- サラダ
UPDATE tags SET sort_order = 180 WHERE slug = 'dessert';     -- デザート
UPDATE tags SET sort_order = 190 WHERE slug = 'cake';        -- ケーキ
UPDATE tags SET sort_order = 200 WHERE slug = 'donut';       -- ドーナツ
UPDATE tags SET sort_order = 210 WHERE slug = 'pancake';     -- パンケーキ
UPDATE tags SET sort_order = 220 WHERE slug = 'ice-cream';   -- アイスクリーム
UPDATE tags SET sort_order = 230 WHERE slug = 'chocolate';   -- チョコレート
UPDATE tags SET sort_order = 240 WHERE slug = 'cheese';      -- チーズ
UPDATE tags SET sort_order = 250 WHERE slug = 'cookie';      -- クッキー
UPDATE tags SET sort_order = 260 WHERE slug = 'coffee';      -- コーヒー
UPDATE tags SET sort_order = 270 WHERE slug = 'wine';        -- ワイン
UPDATE tags SET sort_order = 280 WHERE slug = 'beer';        -- ビール
UPDATE tags SET sort_order = 290 WHERE slug = 'cocktail';    -- カクテル
UPDATE tags SET sort_order = 300 WHERE slug = 'tea';         -- お茶
UPDATE tags SET sort_order = 310 WHERE slug = 'fruit';       -- 果物

-- 建造物 (203)
UPDATE tags SET
  display_name_ja = '建造物全般',
  display_name_en = 'Building (general)',
  display_name_zh = '建筑总览',
  display_name_ko = '건축물 일반',
  display_name_es = 'Edificio en general',
  sort_order = 10
WHERE slug = 'building';

UPDATE tags SET sort_order = 20  WHERE slug = 'castle';        -- 城
UPDATE tags SET sort_order = 30  WHERE slug = 'tower';         -- 塔
UPDATE tags SET sort_order = 40  WHERE slug = 'dam';           -- ダム
UPDATE tags SET sort_order = 50  WHERE slug = 'cathedral';     -- 大聖堂
UPDATE tags SET sort_order = 60  WHERE slug = 'church';        -- 教会
UPDATE tags SET sort_order = 70  WHERE slug = 'pyramid';       -- ピラミッド
UPDATE tags SET sort_order = 80  WHERE slug = 'mosque';        -- モスク
UPDATE tags SET sort_order = 90  WHERE slug = 'fortress';      -- 要塞
UPDATE tags SET sort_order = 100 WHERE slug = 'temple';        -- 寺
UPDATE tags SET sort_order = 110 WHERE slug = 'shrine';        -- 神社
UPDATE tags SET sort_order = 120 WHERE slug = 'lighthouse';    -- 灯台
UPDATE tags SET sort_order = 130 WHERE slug = 'train-station'; -- 駅
UPDATE tags SET sort_order = 140 WHERE slug = 'hotel';         -- ホテル
UPDATE tags SET sort_order = 150 WHERE slug = 'skyscraper';    -- 高層ビル
UPDATE tags SET sort_order = 160 WHERE slug = 'arena';         -- アリーナ
UPDATE tags SET sort_order = 170 WHERE slug = 'stadium';       -- スタジアム
UPDATE tags SET sort_order = 180 WHERE slug = 'tunnel';        -- トンネル
UPDATE tags SET sort_order = 190 WHERE slug = 'gate';          -- 門
UPDATE tags SET sort_order = 200 WHERE slug = 'monument';      -- 記念碑

-- 並び順リスト外 (末尾)
UPDATE tags SET sort_order = 300 WHERE slug = 'bridge';        -- 橋
UPDATE tags SET sort_order = 310 WHERE slug = 'pagoda';        -- 五重塔
UPDATE tags SET sort_order = 320 WHERE slug = 'pier';          -- 桟橋
UPDATE tags SET sort_order = 330 WHERE slug = 'pavilion';      -- パビリオン
