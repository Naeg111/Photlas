-- Issue#149: PostGIS による位置検索の空間インデックス化。
--
-- 目的:
--   SpotRepository.findSpotsWithin200m（半径検索）を Haversine 全件スキャンから
--   ST_DWithin + KNN(<->) ＋ GiST 空間インデックスへ置き換える土台を作る。
--
-- 設計:
--   - geom は latitude/longitude から自動導出する生成カラム（geography(Point,4326)）。
--     アプリ側は従来どおり latitude/longitude を保存すれば geom が自動同期する
--     （Spot エンティティ・PhotoService 等の変更不要。geom は JPA 非マッピングで
--      ネイティブクエリからのみ参照）。
--   - ST_MakePoint の引数順は (経度, 緯度)。NUMERIC を double precision にキャストして
--     ST_MakePoint(float8,float8) を確実に解決させる。生成式の各関数は immutable のため
--     STORED 生成カラムに使用できる。
--   - geography は SP-GiST 非対応のため索引は GiST を用いる。
--   - CREATE EXTENSION は rds_superuser が必要（アプリ接続ユーザー=postgres で自動適用。Issue#149 §9-Q7）。

CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE spots
  ADD COLUMN geom geography(Point, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude::double precision, latitude::double precision), 4326)::geography
  ) STORED;

CREATE INDEX idx_spots_geom ON spots USING GIST (geom);
