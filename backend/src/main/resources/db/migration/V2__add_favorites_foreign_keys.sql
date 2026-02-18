-- favoritesテーブルに外部キー制約を追加
ALTER TABLE favorites
    ADD CONSTRAINT fk_favorites_user_id
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE favorites
    ADD CONSTRAINT fk_favorites_photo_id
    FOREIGN KEY (photo_id) REFERENCES photos(photo_id) ON DELETE CASCADE;
