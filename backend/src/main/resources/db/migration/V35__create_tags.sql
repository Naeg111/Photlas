-- Issue#135 Phase 1: キーワード機能の DB スキーマ
--
-- 設計詳細は documents/04_Issues/Issue#135.md の 4.1 を参照。
--
-- 旧 V4 で削除した tags / photo_tags を新設計（多言語対応・多対多・AI 由来フラグあり）
-- で再導入する。

-- ========================================================================
-- 1) キーワードマスタ
-- ========================================================================
-- 1 行 = 1 キーワード（Rekognition のラベルから Photlas 向けに選別したもの）。
-- 多言語表示名 5 言語を保持。slug は URL に使われる kebab-case。
-- is_active = FALSE は論理削除（物理削除は photo_tags.tag_id FK の RESTRICT で抑止）。
CREATE TABLE IF NOT EXISTS tags (
    id BIGSERIAL PRIMARY KEY,
    rekognition_label VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    display_name_ja VARCHAR(100) NOT NULL,
    display_name_en VARCHAR(100) NOT NULL,
    display_name_zh VARCHAR(100),
    display_name_ko VARCHAR(100),
    display_name_es VARCHAR(100),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ========================================================================
-- 2) キーワード ↔ カテゴリ (多対多)
-- ========================================================================
-- 1 つのキーワードが複数のカテゴリに属する（例: Night Sky → 星空 + 夜景）。
-- category_code は CodeConstants の 200 番台数値コード。
-- tag が論理削除されない通常運用ではこの行は維持されるが、もし tag を物理削除する
-- 場合は連動して削除する（CASCADE）。
CREATE TABLE IF NOT EXISTS tag_categories (
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    category_code INTEGER NOT NULL,
    PRIMARY KEY (tag_id, category_code)
);

-- ========================================================================
-- 3) 写真 ↔ キーワード (多対多)
-- ========================================================================
-- assigned_by: 'AI' / 'USER'。AI 自動付与か手動追加かを記録（分析用）。
-- ai_confidence: AI 由来時の Rekognition 信頼度（0〜100）。USER 由来時は NULL。
--
-- 外部キー方針 (Issue#135 4.1):
--   photo_id: 写真が削除されたらキーワード関連も自然に消える → CASCADE
--   tag_id  : キーワード誤削除で大量の photo_tags が消える事故を防ぐ → RESTRICT
--            （キーワードを使わなくしたい場合は tags.is_active=FALSE の論理削除）
CREATE TABLE IF NOT EXISTS photo_tags (
    photo_id BIGINT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE RESTRICT,
    assigned_by VARCHAR(10) NOT NULL,
    ai_confidence DOUBLE PRECISION,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (photo_id, tag_id),
    CONSTRAINT chk_photo_tags_assigned_by CHECK (assigned_by IN ('AI', 'USER'))
);

-- ========================================================================
-- インデックス
-- ========================================================================
-- slug: ランディングページ /tags/{slug} の lookup 用 (UNIQUE 制約により既に作成されるが
--       PostgreSQL 上は名前を明示しておくと運用しやすいため別途残す)
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);

-- photo_tags.tag_id: キーワード絞り込み検索 (WHERE tag_id IN (...)) 用
CREATE INDEX IF NOT EXISTS idx_photo_tags_tag_id ON photo_tags(tag_id);

-- tag_categories.category_code: 文脈連動表示の「カテゴリ → キーワード一覧」用
CREATE INDEX IF NOT EXISTS idx_tag_categories_category_code ON tag_categories(category_code);
