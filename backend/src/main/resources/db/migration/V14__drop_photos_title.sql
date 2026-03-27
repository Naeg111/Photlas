-- Issue#74: 写真タイトルの廃止
ALTER TABLE photos DROP COLUMN IF EXISTS title;
