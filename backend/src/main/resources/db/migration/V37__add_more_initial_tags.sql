-- Issue#141 後追い: Rekognition 頻出ラベルで V36 に未登録だった代表ラベルを追加。
--
-- 追加カテゴリ別件数:
--   自然 (201)      : 7 件 (Sky / Cloud / Snow / Ice / Fog / Hot Spring / Mushroom*)
--   夜景 (204)      : 3 件 (Fireworks / Lantern / Moon)
--   植物 (206)      : 2 件 (Hydrangea / Pine)  + Mushroom 二重所属
--   動物 (207)      : 3 件 (Pig / Goat / Leopard)
--   野鳥 (208)+207  : 2 件 (Pigeon / Peacock)
--   鉄道 (211)      : 1 件 (Train Station)
--   航空機 (212)    : 2 件 (Drone / Hot Air Balloon)
--   星空 (213)      : 1 件 (Sun)
--   合計            : 21 件
--
-- 多対多: Mushroom は植物 (206) と自然 (201) の二重所属。
-- 翻訳: V36 と同様に ja/en 監修品質、zh/ko/es は機械翻訳ベース。

INSERT INTO tags
  (rekognition_label, slug, display_name_ja, display_name_en, display_name_zh, display_name_ko, display_name_es, sort_order)
VALUES
  -- 自然 (201)
  ('Sky', 'sky', '空', 'Sky', '天空', '하늘', 'Cielo', 100),
  ('Cloud', 'cloud', '雲', 'Cloud', '云', '구름', 'Nube', 100),
  ('Snow', 'snow', '雪', 'Snow', '雪', '눈', 'Nieve', 100),
  ('Ice', 'ice', '氷', 'Ice', '冰', '얼음', 'Hielo', 100),
  ('Fog', 'fog', '霧', 'Fog', '雾', '안개', 'Niebla', 100),
  ('Hot Spring', 'hot-spring', '温泉', 'Hot Spring', '温泉', '온천', 'Aguas termales', 100),
  ('Mushroom', 'mushroom', 'キノコ', 'Mushroom', '蘑菇', '버섯', 'Seta', 100),

  -- 夜景 (204)
  ('Fireworks', 'fireworks', '花火', 'Fireworks', '烟花', '불꽃놀이', 'Fuegos artificiales', 100),
  ('Lantern', 'lantern', '提灯', 'Lantern', '灯笼', '등불', 'Linterna', 100),
  ('Moon', 'moon', '月', 'Moon', '月亮', '달', 'Luna', 100),

  -- 植物 (206)
  ('Hydrangea', 'hydrangea', '紫陽花', 'Hydrangea', '绣球花', '수국', 'Hortensia', 100),
  ('Pine', 'pine', '松', 'Pine', '松树', '소나무', 'Pino', 100),

  -- 動物 (207)
  ('Pig', 'pig', '豚', 'Pig', '猪', '돼지', 'Cerdo', 100),
  ('Goat', 'goat', '山羊', 'Goat', '山羊', '염소', 'Cabra', 100),
  ('Leopard', 'leopard', 'ヒョウ', 'Leopard', '豹', '표범', 'Leopardo', 100),

  -- 野鳥 (208) + 動物 (207) 二重所属
  ('Pigeon', 'pigeon', 'ハト', 'Pigeon', '鸽子', '비둘기', 'Paloma', 100),
  ('Peacock', 'peacock', 'クジャク', 'Peacock', '孔雀', '공작', 'Pavo real', 100),

  -- 鉄道 (211)
  ('Train Station', 'train-station', '駅', 'Train Station', '火车站', '기차역', 'Estación de tren', 100),

  -- 航空機 (212)
  ('Drone', 'drone', 'ドローン', 'Drone', '无人机', '드론', 'Dron', 100),
  ('Hot Air Balloon', 'hot-air-balloon', '熱気球', 'Hot Air Balloon', '热气球', '열기구', 'Globo aerostático', 100),

  -- 星空 (213)
  ('Sun', 'sun', '太陽', 'Sun', '太阳', '태양', 'Sol', 100)
;

INSERT INTO tag_categories (tag_id, category_code) VALUES
  -- 自然 (201)
  ((SELECT id FROM tags WHERE slug='sky'), 201),
  ((SELECT id FROM tags WHERE slug='cloud'), 201),
  ((SELECT id FROM tags WHERE slug='snow'), 201),
  ((SELECT id FROM tags WHERE slug='ice'), 201),
  ((SELECT id FROM tags WHERE slug='fog'), 201),
  ((SELECT id FROM tags WHERE slug='hot-spring'), 201),
  ((SELECT id FROM tags WHERE slug='mushroom'), 201),

  -- 夜景 (204)
  ((SELECT id FROM tags WHERE slug='fireworks'), 204),
  ((SELECT id FROM tags WHERE slug='lantern'), 204),
  ((SELECT id FROM tags WHERE slug='moon'), 204),

  -- 植物 (206)
  ((SELECT id FROM tags WHERE slug='hydrangea'), 206),
  ((SELECT id FROM tags WHERE slug='pine'), 206),
  ((SELECT id FROM tags WHERE slug='mushroom'), 206),

  -- 動物 (207)
  ((SELECT id FROM tags WHERE slug='pig'), 207),
  ((SELECT id FROM tags WHERE slug='goat'), 207),
  ((SELECT id FROM tags WHERE slug='leopard'), 207),

  -- 野鳥 (208): pigeon / peacock は 207 + 208 の二重所属
  ((SELECT id FROM tags WHERE slug='pigeon'), 207),
  ((SELECT id FROM tags WHERE slug='pigeon'), 208),
  ((SELECT id FROM tags WHERE slug='peacock'), 207),
  ((SELECT id FROM tags WHERE slug='peacock'), 208),

  -- 鉄道 (211)
  ((SELECT id FROM tags WHERE slug='train-station'), 211),

  -- 航空機 (212)
  ((SELECT id FROM tags WHERE slug='drone'), 212),
  ((SELECT id FROM tags WHERE slug='hot-air-balloon'), 212),

  -- 星空 (213)
  ((SELECT id FROM tags WHERE slug='sun'), 213)
;
