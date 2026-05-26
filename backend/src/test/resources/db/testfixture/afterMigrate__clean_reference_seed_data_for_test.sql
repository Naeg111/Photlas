-- Issue#120（テスト専用 / Flyway コールバック）: シードされた参照データ（タグ・カテゴリ）を空に戻す。
--
-- なぜ「コールバック」か:
--   当初は versioned migration(V900) で実装したが、それだと Flyway の適用履歴に version=900 が
--   記録され、以後に追加する通常マイグレーション(例: Issue#149 の V43)が「順序が古い(out-of-order)」
--   と判定されてテストで失敗してしまう。
--   afterMigrate コールバックは「migrate 完了後に毎回実行される」非バージョン処理のため、
--   将来のマイグレーション順序に一切干渉しない。冪等(DELETE)なので毎回流れても安全。
--
-- 背景:
--   旧テストDB(H2)は ddl-auto=create-drop でエンティティからスキーマを生成しており、
--   Flyway のシード migration (V36〜V41) が走らないため tags / tag_categories は常に空だった。
--   そのため既存のタグ関連テストはすべて「空の参照テーブル」を前提に書かれている。
--   PostgreSQL + Flyway では 193 件のタグが事前投入され、テストの自前投入と
--   rekognition_label の一意制約等で衝突する。実マイグレーション(V1〜)はそのまま適用・
--   検証したうえで、本コールバックで参照データだけを空に戻し、旧 H2 と同じ初期状態に揃える。
--
-- 適用範囲:
--   このファイルは test プロファイルの Flyway ロケーション (classpath:db/testfixture) からのみ
--   読み込まれる(src/test 配下)。本番・ステージングは classpath:db/migration のみを見るため影響しない。

DELETE FROM photo_tags;
DELETE FROM tag_categories;
DELETE FROM tags;
DELETE FROM categories;
