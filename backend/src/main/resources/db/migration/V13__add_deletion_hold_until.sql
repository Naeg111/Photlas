-- Issue#73: 保持期間延長対応
ALTER TABLE users ADD COLUMN deletion_hold_until TIMESTAMP DEFAULT NULL;
