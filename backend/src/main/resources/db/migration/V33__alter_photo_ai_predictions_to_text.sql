-- V33: photo_ai_predictions の JSONB カラムを TEXT に変更（Issue#119, Issue#120 関連）
--
-- 経緯:
--   V30 で predicted_categories と confidence を JSONB として作成したが、
--   テスト時の H2 in-memory DB では JSONB ネイティブ型が利用できない。
--   Phase 3 の @Lob → OID 障害の教訓から、案1（String + Jackson、アプリ層 serialize）を採用する。
--
-- 将来の JSONB 化:
--   Issue#120（テスト DB を PostgreSQL 化）解決後、JSONB クエリの具体的需要発生時に
--   ALTER TABLE で JSONB に戻す方針（Issue#119 8. 未決事項を参照）。
--   データ消失なしで TEXT → JSONB に戻せる。
--
-- 影響:
--   既存データは USING column::text で TEXT 変換される。
--   このテーブルは Phase 3〜5 デプロイ時点ではまだデータが入っていないが、念のため安全な変換を指定。

ALTER TABLE photo_ai_predictions
    ALTER COLUMN predicted_categories TYPE TEXT USING predicted_categories::text,
    ALTER COLUMN confidence TYPE TEXT USING confidence::text;

COMMENT ON COLUMN photo_ai_predictions.predicted_categories IS
    'AI が判定したカテゴリID配列（200番台、Jackson で JSON 文字列化）。例: [201, 204]';
COMMENT ON COLUMN photo_ai_predictions.confidence IS
    '各カテゴリ/天候の信頼度（Jackson で JSON 文字列化）。例: {"201": 92.5, "204": 78.2}';
