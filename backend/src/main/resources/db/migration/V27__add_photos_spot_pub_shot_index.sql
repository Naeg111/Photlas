-- Issue#112: スポット写真ID一覧の段階的読み込み（ページネーション）用の複合インデックス
--
-- POST /api/v1/spots/photos のクエリは以下の特性を持つ:
--   - spot_id IN (...) で複数スポット横断
--   - moderation_status = PUBLISHED でフィルタ
--   - shot_at DESC NULLS LAST, photo_id DESC で並び替え
--   - LIMIT / OFFSET でページング
--
-- 単独の idx_photos_spot_id（V1）では並び替えにテーブル全体の sort が
-- 必要になるため、複合インデックスで「フィルタ＋並び替え」を一発で済ませる。

CREATE INDEX IF NOT EXISTS idx_photos_spot_pub_shot
  ON photos(spot_id, moderation_status, shot_at DESC NULLS LAST, photo_id DESC);
