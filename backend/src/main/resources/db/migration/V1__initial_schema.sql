-- V1: 初期スキーマ（全テーブル + インデックス）
-- 既存のデータベースにはbaseline-on-migrateで適用をスキップ

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(12) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(10) NOT NULL,
    profile_image_s3_key VARCHAR(512),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- スポットテーブル
CREATE TABLE IF NOT EXISTS spots (
    spot_id BIGSERIAL PRIMARY KEY,
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    created_by_user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- カテゴリテーブル
CREATE TABLE IF NOT EXISTS categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- タグテーブル
CREATE TABLE IF NOT EXISTS tags (
    tag_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 写真テーブル
CREATE TABLE IF NOT EXISTS photos (
    photo_id BIGSERIAL PRIMARY KEY,
    spot_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    s3_object_key VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(20),
    shot_at TIMESTAMP,
    weather VARCHAR(50),
    time_of_day VARCHAR(20),
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    shooting_direction NUMERIC(5, 2),
    camera_body VARCHAR(100),
    camera_lens VARCHAR(100),
    focal_length_35mm INTEGER,
    f_value VARCHAR(20),
    shutter_speed VARCHAR(20),
    iso INTEGER,
    image_width INTEGER,
    image_height INTEGER,
    crop_center_x DOUBLE PRECISION,
    crop_center_y DOUBLE PRECISION,
    crop_zoom DOUBLE PRECISION,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 写真-カテゴリ中間テーブル
CREATE TABLE IF NOT EXISTS photo_categories (
    photo_id BIGINT NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (photo_id, category_id)
);

-- 写真-タグ中間テーブル
CREATE TABLE IF NOT EXISTS photo_tags (
    photo_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    PRIMARY KEY (photo_id, tag_id)
);

-- お気に入りテーブル
CREATE TABLE IF NOT EXISTS favorites (
    user_id BIGINT NOT NULL,
    photo_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, photo_id)
);

-- パスワードリセットトークンテーブル
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expiry_date TIMESTAMP NOT NULL
);

-- SNSリンクテーブル
CREATE TABLE IF NOT EXISTS user_sns_links (
    sns_link_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    platform VARCHAR(20),
    url VARCHAR(2048) NOT NULL
);

-- 通報テーブル
CREATE TABLE IF NOT EXISTS reports (
    reporting_user_id BIGINT NOT NULL,
    photo_id BIGINT NOT NULL,
    reason VARCHAR(50) NOT NULL,
    details VARCHAR(300) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (reporting_user_id, photo_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_photos_spot_id ON photos(spot_id);
CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at);
CREATE INDEX IF NOT EXISTS idx_spots_lat_lng ON spots(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_spots_created_by ON spots(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_photo_id ON favorites(photo_id);
CREATE INDEX IF NOT EXISTS idx_reports_photo_id ON reports(photo_id);
