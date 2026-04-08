-- Issue#54: モデレーション詳細テーブルにAI検出ラベルカラムを追加
ALTER TABLE moderation_details ADD COLUMN detected_labels TEXT;
