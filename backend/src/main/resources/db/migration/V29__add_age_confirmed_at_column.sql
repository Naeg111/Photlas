-- V29: 年齢確認日時カラムを users テーブルに追加（Issue#109）
--
-- 利用規約・プライバシーポリシーで明示している「13 歳以上」の利用制限について、
-- サインアップフローでチェックボックスによる自己申告を取得し、その日時を記録する。
--
-- - メール+パスワード登録時: AuthService.registerUser で NOW() をセット（規約・プライバシーと同時）
-- - OAuth 新規登録時: NULL（後段の同意ダイアログで POST agree-terms により更新）
-- - 既存テストアカウント: NULL のまま残るが、ローンチ前のためテストアカウントは作り直しか手動更新で対応

ALTER TABLE users ADD COLUMN age_confirmed_at TIMESTAMP NULL;

COMMENT ON COLUMN users.age_confirmed_at IS
    '年齢確認（13 歳以上）の自己申告日時（Issue#109）。NULL の場合は未確認で、フロントエンドで同意ダイアログを表示する。';
