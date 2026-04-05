-- Issue#87: DB保存値の桁区切り数値コード化
-- 全enum的な文字列カラムを整数に変換する

-- ========== 1. photos.weather (日本語文字列 → 400番台) ==========
ALTER TABLE photos ADD COLUMN weather_new INTEGER;
UPDATE photos SET weather_new = CASE weather
    WHEN '晴れ' THEN 401
    WHEN '曇り' THEN 402
    WHEN '雨' THEN 403
    WHEN '雪' THEN 404
    ELSE NULL
END;
ALTER TABLE photos DROP COLUMN weather;
ALTER TABLE photos RENAME COLUMN weather_new TO weather;

-- ========== 2. photos.time_of_day (英語文字列 → 300番台) ==========
ALTER TABLE photos ADD COLUMN time_of_day_new INTEGER;
UPDATE photos SET time_of_day_new = CASE time_of_day
    WHEN 'MORNING' THEN 301
    WHEN 'DAY' THEN 302
    WHEN 'EVENING' THEN 303
    WHEN 'NIGHT' THEN 304
    ELSE NULL
END;
ALTER TABLE photos DROP COLUMN time_of_day;
ALTER TABLE photos RENAME COLUMN time_of_day_new TO time_of_day;

-- ========== 3. photos.device_type (英語文字列 → 500番台) ==========
ALTER TABLE photos ADD COLUMN device_type_new INTEGER;
UPDATE photos SET device_type_new = CASE device_type
    WHEN 'SLR' THEN 501
    WHEN 'MIRRORLESS' THEN 502
    WHEN 'COMPACT' THEN 503
    WHEN 'SMARTPHONE' THEN 504
    WHEN 'FILM' THEN 505
    WHEN 'OTHER' THEN 506
    ELSE NULL
END;
ALTER TABLE photos DROP COLUMN device_type;
ALTER TABLE photos RENAME COLUMN device_type_new TO device_type;

-- ========== 4. photos.moderation_status (英語文字列 → 1000番台) ==========
ALTER TABLE photos ADD COLUMN moderation_status_new INTEGER NOT NULL DEFAULT 1001;
UPDATE photos SET moderation_status_new = CASE moderation_status
    WHEN 'PENDING_REVIEW' THEN 1001
    WHEN 'PUBLISHED' THEN 1002
    WHEN 'QUARANTINED' THEN 1003
    WHEN 'REMOVED' THEN 1004
    ELSE 1001
END;
ALTER TABLE photos DROP COLUMN moderation_status;
ALTER TABLE photos RENAME COLUMN moderation_status_new TO moderation_status;

-- ========== 5. users.role (英語文字列 → 100番台) ==========
ALTER TABLE users ADD COLUMN role_new INTEGER NOT NULL DEFAULT 101;
UPDATE users SET role_new = CASE role
    WHEN 'USER' THEN 101
    WHEN 'ADMIN' THEN 102
    WHEN 'SUSPENDED' THEN 103
    ELSE 101
END;
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users RENAME COLUMN role_new TO role;

-- ========== 6. user_sns_links.platform (英語小文字文字列 → 600番台) ==========
ALTER TABLE user_sns_links ADD COLUMN platform_new INTEGER;
UPDATE user_sns_links SET platform_new = CASE platform
    WHEN 'twitter' THEN 601
    WHEN 'instagram' THEN 602
    WHEN 'youtube' THEN 603
    WHEN 'tiktok' THEN 604
    ELSE NULL
END;
ALTER TABLE user_sns_links DROP COLUMN platform;
ALTER TABLE user_sns_links RENAME COLUMN platform_new TO platform;

-- ========== 7. account_sanctions.sanction_type (英語文字列 → 700番台) ==========
ALTER TABLE account_sanctions ADD COLUMN sanction_type_new INTEGER NOT NULL DEFAULT 701;
UPDATE account_sanctions SET sanction_type_new = CASE sanction_type
    WHEN 'WARNING' THEN 701
    WHEN 'TEMPORARY_SUSPENSION' THEN 702
    WHEN 'PERMANENT_SUSPENSION' THEN 703
    ELSE 701
END;
ALTER TABLE account_sanctions DROP COLUMN sanction_type;
ALTER TABLE account_sanctions RENAME COLUMN sanction_type_new TO sanction_type;

-- ========== 8. violations.violation_type (英語文字列 → 800番台) ==========
ALTER TABLE violations ADD COLUMN violation_type_new INTEGER NOT NULL DEFAULT 806;
UPDATE violations SET violation_type_new = CASE violation_type
    WHEN 'ADULT_CONTENT' THEN 801
    WHEN 'VIOLENCE' THEN 802
    WHEN 'COPYRIGHT_INFRINGEMENT' THEN 803
    WHEN 'PRIVACY_VIOLATION' THEN 804
    WHEN 'SPAM' THEN 805
    WHEN 'OTHER' THEN 806
    ELSE 806
END;
ALTER TABLE violations DROP COLUMN violation_type;
ALTER TABLE violations RENAME COLUMN violation_type_new TO violation_type;

-- ========== 9. violations.action_taken (英語文字列 → 1300番台) ==========
ALTER TABLE violations ADD COLUMN action_taken_new INTEGER NOT NULL DEFAULT 1301;
UPDATE violations SET action_taken_new = CASE action_taken
    WHEN 'REMOVED' THEN 1301
    ELSE 1301
END;
ALTER TABLE violations DROP COLUMN action_taken;
ALTER TABLE violations RENAME COLUMN action_taken_new TO action_taken;

-- ========== 10. violations.target_type (英語文字列 → 1100番台) ==========
ALTER TABLE violations ADD COLUMN target_type_new INTEGER NOT NULL DEFAULT 1101;
UPDATE violations SET target_type_new = CASE target_type
    WHEN 'PHOTO' THEN 1101
    WHEN 'PROFILE' THEN 1102
    ELSE 1101
END;
ALTER TABLE violations DROP COLUMN target_type;
ALTER TABLE violations RENAME COLUMN target_type_new TO target_type;

-- ========== 11. reports.target_type (英語文字列 → 1100番台) ==========
ALTER TABLE reports ADD COLUMN target_type_new INTEGER NOT NULL DEFAULT 1101;
UPDATE reports SET target_type_new = CASE target_type
    WHEN 'PHOTO' THEN 1101
    WHEN 'PROFILE' THEN 1102
    ELSE 1101
END;
ALTER TABLE reports DROP COLUMN target_type;
ALTER TABLE reports RENAME COLUMN target_type_new TO target_type;

-- ========== 12. reports.reason_category (英語文字列 → 800番台) ==========
ALTER TABLE reports ADD COLUMN reason_category_new INTEGER NOT NULL DEFAULT 806;
UPDATE reports SET reason_category_new = CASE reason_category
    WHEN 'ADULT_CONTENT' THEN 801
    WHEN 'VIOLENCE' THEN 802
    WHEN 'COPYRIGHT_INFRINGEMENT' THEN 803
    WHEN 'PRIVACY_VIOLATION' THEN 804
    WHEN 'SPAM' THEN 805
    WHEN 'OTHER' THEN 806
    ELSE 806
END;
ALTER TABLE reports DROP COLUMN reason_category;
ALTER TABLE reports RENAME COLUMN reason_category_new TO reason_category;

-- ========== 13. moderation_details.source (英語文字列 → 900番台) ==========
ALTER TABLE moderation_details ADD COLUMN source_new INTEGER NOT NULL DEFAULT 901;
UPDATE moderation_details SET source_new = CASE source
    WHEN 'AI_SCAN' THEN 901
    ELSE 901
END;
ALTER TABLE moderation_details DROP COLUMN source;
ALTER TABLE moderation_details RENAME COLUMN source_new TO source;

-- ========== 14. moderation_details.target_type (英語文字列 → 1100番台) ==========
ALTER TABLE moderation_details ADD COLUMN target_type_new INTEGER NOT NULL DEFAULT 1101;
UPDATE moderation_details SET target_type_new = CASE target_type
    WHEN 'PHOTO' THEN 1101
    WHEN 'PROFILE' THEN 1102
    ELSE 1101
END;
ALTER TABLE moderation_details DROP COLUMN target_type;
ALTER TABLE moderation_details RENAME COLUMN target_type_new TO target_type;

-- ========== 15. location_suggestions.status (英語文字列 → 1200番台) ==========
ALTER TABLE location_suggestions ADD COLUMN status_new INTEGER NOT NULL DEFAULT 1201;
UPDATE location_suggestions SET status_new = CASE status
    WHEN 'PENDING' THEN 1201
    WHEN 'ACCEPTED' THEN 1202
    WHEN 'REJECTED' THEN 1203
    ELSE 1201
END;
ALTER TABLE location_suggestions DROP COLUMN status;
ALTER TABLE location_suggestions RENAME COLUMN status_new TO status;

-- ========== 16. categories.category_id (自動採番 → 200番台固定ID) ==========
-- まず旧ID→新IDのマッピングテーブルを作成
CREATE TEMPORARY TABLE category_id_map (old_id INTEGER, new_id INTEGER);
INSERT INTO category_id_map (old_id, new_id)
SELECT c.category_id, CASE c.name
    WHEN '自然風景' THEN 201
    WHEN '街並み' THEN 202
    WHEN '建造物' THEN 203
    WHEN '夜景' THEN 204
    WHEN 'グルメ' THEN 205
    WHEN '植物' THEN 206
    WHEN '動物' THEN 207
    WHEN '野鳥' THEN 208
    WHEN '自動車' THEN 209
    WHEN 'バイク' THEN 210
    WHEN '鉄道' THEN 211
    WHEN '飛行機' THEN 212
    WHEN '星空' THEN 213
    WHEN 'その他' THEN 214
    -- 旧カテゴリ名への対応
    WHEN '風景' THEN 201
    WHEN '食べ物' THEN 205
    WHEN 'ポートレート' THEN 214
    ELSE 214
END
FROM categories c;

-- photo_categoriesのcategory_idを新IDに更新（FK制約なし）
UPDATE photo_categories SET category_id = (
    SELECT new_id FROM category_id_map WHERE old_id = photo_categories.category_id
)
WHERE EXISTS (SELECT 1 FROM category_id_map WHERE old_id = photo_categories.category_id);

-- categoriesテーブルに新IDの行を作成
INSERT INTO categories (category_id, name)
SELECT m.new_id, c.name
FROM category_id_map m
JOIN categories c ON c.category_id = m.old_id
WHERE m.new_id != m.old_id
ON CONFLICT (category_id) DO NOTHING;

-- 旧IDの行を削除（新IDに移行済みの場合のみ）
DELETE FROM categories WHERE category_id IN (
    SELECT old_id FROM category_id_map WHERE old_id != new_id
);

DROP TABLE category_id_map;

-- categoriesのSERIAL自動採番シーケンスを200番台以降に設定
ALTER SEQUENCE categories_category_id_seq RESTART WITH 215;

-- reports テーブルのユニーク制約を再作成（target_typeカラムの型が変わったため）
-- 既存の制約は自動的にカラム削除時に除去されるため、再作成のみ
ALTER TABLE reports ADD CONSTRAINT uk_reports_reporter_target UNIQUE (reporter_user_id, target_type, target_id);
