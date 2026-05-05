-- V30: AI 画像認識結果保存テーブル（Issue#119）
--
-- AWS Rekognition による画像解析結果（カテゴリ・天候の予測値）を、
-- ユーザーが選択した最終的な値（photos テーブル）とは別に保存する。
--
-- 目的:
--   - 将来 AI モデルを切り替えた際、新旧予測結果を残せる（model_name で区別）
--   - 「ユーザー選択 vs AI 予測」の乖離（user_diff_flag）を運営が事後確認できる
--   - 写真削除時は ON DELETE CASCADE で連動削除（GDPR 等のデータ削除要請対応）
--
-- 注意点:
--   - predicted_categories は JSONB で配列保存（例: [201, 204]）。photo_categories の正規化テーブルとは別。
--   - predicted_weather は INTEGER（既存 photos.weather と同じく 401-404 のコード）。AI が判定不可なら NULL。
--   - 1写真 × 1モデルにつき1レコード（UNIQUE 制約）。

CREATE TABLE IF NOT EXISTS photo_ai_predictions (
    id BIGSERIAL PRIMARY KEY,
    photo_id BIGINT NOT NULL REFERENCES photos(photo_id) ON DELETE CASCADE,
    model_name VARCHAR(50) NOT NULL,
    model_version VARCHAR(20),
    predicted_categories JSONB NOT NULL,
    predicted_weather INTEGER,
    confidence JSONB NOT NULL,
    user_diff_flag BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_photo_ai_predictions_photo_model UNIQUE (photo_id, model_name)
);

CREATE INDEX IF NOT EXISTS idx_photo_ai_predictions_photo_id ON photo_ai_predictions(photo_id);

-- user_diff_flag = TRUE のみ部分インデックス化（モデレーション対象抽出用、サイズ抑制）
CREATE INDEX IF NOT EXISTS idx_photo_ai_predictions_user_diff_flag
    ON photo_ai_predictions(user_diff_flag) WHERE user_diff_flag = TRUE;

COMMENT ON TABLE photo_ai_predictions IS
    'AI 画像認識（AWS Rekognition 等）の予測結果。ユーザー選択は photos 側、こちらは AI 判定値の記録専用。';
COMMENT ON COLUMN photo_ai_predictions.model_name IS
    'AI モデル名（例: rekognition-detect-labels）。同一写真でも複数モデルの結果を保持可能。';
COMMENT ON COLUMN photo_ai_predictions.predicted_categories IS
    'AI が判定したカテゴリID配列（200番台、JSONB）。例: [201, 204]';
COMMENT ON COLUMN photo_ai_predictions.predicted_weather IS
    'AI が判定した天候コード（400番台 INTEGER）。判定不可なら NULL。';
COMMENT ON COLUMN photo_ai_predictions.confidence IS
    '各カテゴリ/天候の信頼度（JSONB）。例: {"201": 92.5, "204": 78.2}';
COMMENT ON COLUMN photo_ai_predictions.user_diff_flag IS
    'ユーザー選択カテゴリと AI 予測カテゴリの重複ゼロなら TRUE（運営の事後確認対象）。';
