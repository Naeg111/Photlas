-- password_reset_tokensテーブルにユーザーへの外部キー制約を追加
-- ユーザー物理削除時にトークンも自動削除される
ALTER TABLE password_reset_tokens
    ADD CONSTRAINT fk_password_reset_tokens_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
