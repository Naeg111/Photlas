-- V32: ai_prediction_cache.ai_result を JSONB から TEXT に変更（Issue#119, Issue#120 関連）
--
-- 経緯:
--   V31 で ai_result を JSONB として作成したが、テスト時の H2 in-memory DB では
--   JSONB ネイティブ型が利用できず、エンティティ層で Hibernate 固有のアノテーション
--   (@JdbcTypeCode(SqlTypes.JSON) 等) が必要になる。
--
--   ai_prediction_cache テーブルは以下の特徴を持つ:
--   - 投稿確定までの一時保管（TTL 15分）専用
--   - JSON の中身を SQL で問い合わせることはない（PK アクセス・期限フィルタのみ）
--   - JSONB の利点（インデックス可能なクエリ・型検証）を享受する場面がない
--
--   よって、シンプルさを優先して TEXT に変更する。アプリ層で Jackson による
--   serialize / deserialize を行い、検証もアプリ層で完結する。
--
-- 注意:
--   既存データは USING ai_result::text で TEXT へ変換される。
--   JSONB の文字列表現がそのまま TEXT に入るため、データ消失なし。
--   （ただし staging 環境のキャッシュは 15分で自動消滅するため、データの永続化は問題にならない）

ALTER TABLE ai_prediction_cache
    ALTER COLUMN ai_result TYPE TEXT USING ai_result::text;

COMMENT ON COLUMN ai_prediction_cache.ai_result IS
    'AI 結果 JSON（categories, weather, confidence をまとめたもの）。アプリ層で Jackson により serialize / deserialize される。';
