-- V31: AI 解析結果の一時保管テーブル（Issue#119）
--
-- POST /api/v1/photos/analyze で得た AI 結果を、後の正式投稿（POST /api/v1/photos）まで
-- サーバーサイドで一時保管する。フロントは analyzeToken（UUID）のみ持ち、AI 結果本体は持たない。
--
-- 目的:
--   - フロントエンドからの AI 結果改ざんを防ぐ
--   - スケールアウト対応（複数 EC2 が同じ RDS を共有）
--   - 既存 RDS を使うため追加インフラなし
--
-- TTL:
--   - expires_at = analyze 実行時刻 + 15 分
--   - 期限切れトークンは Spring Scheduled タスクで日次クリーンアップ

CREATE TABLE IF NOT EXISTS ai_prediction_cache (
    analyze_token VARCHAR(36) PRIMARY KEY,
    ai_result JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_prediction_cache_expires_at ON ai_prediction_cache(expires_at);

COMMENT ON TABLE ai_prediction_cache IS
    'AI 解析結果の一時保管（TTL 15分）。analyzeToken でフロントが参照、投稿確定時に DELETE。';
COMMENT ON COLUMN ai_prediction_cache.analyze_token IS
    'UUID v4。フロントが投稿時に送信するトークン。';
COMMENT ON COLUMN ai_prediction_cache.ai_result IS
    'AI 結果 JSON（categories, weather, confidence をまとめたもの）。';
COMMENT ON COLUMN ai_prediction_cache.expires_at IS
    '有効期限（analyze 実行時刻 + 15分）。これを過ぎたら無効。';
