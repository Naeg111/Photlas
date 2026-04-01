-- 既存の shot_at をUTC→JST（+9時間）に変換
-- フロントエンドが toISOString() でUTCに変換して保存していたため、
-- ローカル時刻（JST）での保存方式に合わせて補正する
UPDATE photos SET shot_at = shot_at + interval '9 hours' WHERE shot_at IS NOT NULL;
