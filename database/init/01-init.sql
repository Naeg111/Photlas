-- Issue#4: PostgreSQL初期化スクリプト
-- Docker環境でのデータベース初期設定

-- データベースが存在しない場合は作成
-- CREATE DATABASE photlas_dev; (既に環境変数で指定済み)

-- 必要に応じて追加のテーブルや設定をここに記述
-- (Spring Boot JPA が自動的にテーブルを作成するため、基本的には空で良い)

-- タイムゾーンを設定
SET timezone = 'Asia/Tokyo';