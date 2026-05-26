-- Issue#120: テスト用データベースの作成
--
-- ローカルで `./gradlew test` を実行する際の接続先（application-test.properties が参照）。
-- 開発用 DB(photlas_dev) とテスト用 DB を分けることで、テスト実行が開発データを壊さない。
--
-- 注意: docker-entrypoint-initdb.d のスクリプトは、データボリュームが空の「初回初期化時」
--       のみ実行される。既存ボリュームでは再実行されないため、その場合は手動作成が必要。
--
-- PostGIS 拡張(CREATE EXTENSION postgis)は本スクリプトでは有効化しない。
-- 拡張は Flyway マイグレーション(Issue#149 で追加予定)で全環境共通に有効化する方針。
-- 本イメージ(postgis/postgis)は拡張を「利用可能」にするだけ。

CREATE DATABASE photlas_test OWNER photlas_user;
