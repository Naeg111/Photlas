-- Issue#54: 通報テーブルの再設計
-- 投稿とプロフィール画像の両方を通報可能にし、通報件数による自動隔離を実装

-- 既存テーブルをリネーム
ALTER TABLE reports RENAME TO reports_old;

-- 新しい通報テーブルを作成
CREATE TABLE reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_user_id BIGINT NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT NOT NULL,
    reason_category VARCHAR(50) NOT NULL,
    reason_text VARCHAR(300),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_reports_reporter_target UNIQUE (reporter_user_id, target_type, target_id)
);

-- 既存データを移行（target_type='PHOTO', 旧reason→新reason_categoryにマッピング）
INSERT INTO reports (reporter_user_id, target_type, target_id, reason_category, reason_text, created_at)
SELECT
    reporting_user_id,
    'PHOTO',
    photo_id,
    CASE reason
        WHEN 'INAPPROPRIATE_CONTENT' THEN 'ADULT_CONTENT'
        WHEN 'PRIVACY_VIOLATION' THEN 'PRIVACY_VIOLATION'
        WHEN 'WRONG_LOCATION' THEN 'OTHER'
        WHEN 'COPYRIGHT_INFRINGEMENT' THEN 'COPYRIGHT_INFRINGEMENT'
        ELSE 'OTHER'
    END,
    details,
    created_at
FROM reports_old;

-- 旧テーブルを削除
DROP TABLE reports_old;

-- インデックスを追加
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id);
