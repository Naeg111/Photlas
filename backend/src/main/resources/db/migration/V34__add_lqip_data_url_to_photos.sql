-- V34: 写真テーブルに LQIP（低品質プレースホルダー）の data URL カラムを追加（Issue#125）
--
-- LQIP は 20×20 px 程度の WebP（base64 化した data URL、~800 byte）で、
-- 写真詳細ダイアログやプロフィールページの写真グリッドで「本物のサムネイルが
-- 読み込まれるまでぼかし表示する」用途に使う。
--
-- 値の生成: サムネイル生成 Lambda が thumbnails/...webp の作成と同時に LQIP を作り、
--          POST /api/v1/internal/photos/lqip にコールバックして DB に書き込む。
-- NULL 許容: Lambda コールバック未到達のレース条件、および本 Issue リリース前の既存写真
--           （遡及生成しない方針）の両方で NULL が許容される必要がある。フロントは
--           NULL の場合に従来挙動（白枠 → 写真）にフォールバックする。
-- 型: ~800 byte が想定値だが、上限を厳密にしない方が将来の方式変更（例: BlurHash 等）
--    にも柔軟。バックエンド側の Controller で 10KB の防御的上限を設ける。

ALTER TABLE photos ADD COLUMN lqip_data_url TEXT NULL;

COMMENT ON COLUMN photos.lqip_data_url IS
    'LQIP（低品質プレースホルダー）の data URL 形式（data:image/webp;base64,...、Issue#125）。NULL の場合はフロントが従来挙動にフォールバックする。';
