-- Issue#54: モデレーション関連テーブルの追加

-- 違反履歴テーブル
CREATE TABLE IF NOT EXISTS violations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT NOT NULL,
    violation_type VARCHAR(50) NOT NULL,
    action_taken VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_violations_user_id ON violations(user_id);

-- アカウント制裁テーブル
CREATE TABLE IF NOT EXISTS account_sanctions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    sanction_type VARCHAR(30) NOT NULL,
    reason VARCHAR(500),
    suspended_until TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_account_sanctions_user_id ON account_sanctions(user_id);

-- モデレーション詳細テーブル
CREATE TABLE IF NOT EXISTS moderation_details (
    id BIGSERIAL PRIMARY KEY,
    target_type VARCHAR(20) NOT NULL,
    target_id BIGINT NOT NULL,
    source VARCHAR(20) NOT NULL,
    ai_confidence_score DOUBLE PRECISION,
    is_csam_flagged BOOLEAN NOT NULL DEFAULT FALSE,
    quarantined_at TIMESTAMP,
    removed_at TIMESTAMP,
    scheduled_deletion_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_moderation_details_target ON moderation_details(target_type, target_id);
