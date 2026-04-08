-- Issue#91: ユーザーの言語設定カラムを追加
ALTER TABLE users ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT 'ja';
