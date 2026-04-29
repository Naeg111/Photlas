-- V26: 利用規約・プライバシーポリシー同意日時カラムを users テーブルに追加（Issue#104）
--
-- OAuth 経由の新規ユーザーに対して、利用規約・プライバシーポリシーへの同意を
-- 明示的に取得するための日時カラムを追加する。
--
-- - メール+パスワード登録時: AuthService.registerUser で両カラムに NOW() をセット
-- - OAuth 新規登録時: 両カラムは NULL（後段の同意ダイアログで POST agree-terms により更新）
-- - 利用規約改訂時: 運用 SQL で両カラムを NULL にリセット → 次回アクセス時に再同意ダイアログ表示

ALTER TABLE users ADD COLUMN terms_agreed_at TIMESTAMP NULL;
ALTER TABLE users ADD COLUMN privacy_policy_agreed_at TIMESTAMP NULL;

COMMENT ON COLUMN users.terms_agreed_at IS
    '利用規約への同意日時（Issue#104）。NULL の場合は未同意で、フロントエンドで同意ダイアログを表示する。';
COMMENT ON COLUMN users.privacy_policy_agreed_at IS
    'プライバシーポリシーへの同意日時（Issue#104）。NULL の場合は未同意で、フロントエンドで同意ダイアログを表示する。';
