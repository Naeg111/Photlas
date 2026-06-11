-- Issue#142: 動物(207) 配下の中立な鳥タグ「鳥」(companion-bird) を新設する。
--
-- 目的:
--   焦点距離 <300mm / 欠落 の鳥写真では、野鳥系タグ（野鳥全般＋種別）の代わりに
--   小カテゴリ「鳥」として提案する（TagService.extractSuggestions のリマップ経由でのみ注入）。
--
-- 設計上の注意:
--   - rekognition_label は NOT NULL UNIQUE（V35）。Rekognition が実際には返さない合成値
--     'CompanionBird' を用いる。これにより既存 'Bird'(=野鳥全般) と衝突せず、かつ
--     直接ラベル一致では提案されない（リマップ専用）。
--   - tag_categories は 207(動物) のみに紐付ける（208 野鳥には紐付けない）。
--   - is_active / created_at / updated_at は DEFAULT（TRUE / CURRENT_TIMESTAMP）に任せる（V36 と同様）。
--   - 冪等性のため WHERE NOT EXISTS で二重投入を防ぐ。

INSERT INTO tags
  (rekognition_label, slug, display_name_ja, display_name_en, display_name_zh, display_name_ko, display_name_es, sort_order)
SELECT 'CompanionBird', 'companion-bird', '鳥', 'Bird', '鸟', '새', 'Pájaro', 10
WHERE NOT EXISTS (SELECT 1 FROM tags WHERE slug = 'companion-bird');

INSERT INTO tag_categories (tag_id, category_code)
SELECT t.id, 207
FROM tags t
WHERE t.slug = 'companion-bird'
  AND NOT EXISTS (
    SELECT 1 FROM tag_categories tc WHERE tc.tag_id = t.id AND tc.category_code = 207
  );
