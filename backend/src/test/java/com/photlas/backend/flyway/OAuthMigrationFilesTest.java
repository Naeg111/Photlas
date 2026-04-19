package com.photlas.backend.flyway;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#81 Phase 1 Red: OAuth 関連 Flyway マイグレーションファイル存在チェック
 *
 * Round 12 四次精査 / Q15 で「H2 で Flyway を実行して V22〜V25 適用を検証する」と
 * 決定したが、既存 V9 が PostgreSQL 専用の `DO $$...$$` ブロックを含むため H2 では
 * （PostgreSQL 互換モードを有効にしても）構文エラーで落ちる。そのため実際の
 * マイグレーション適用検証は Phase 6 のステージング手動検証（`flyway:info` で
 * V22〜V25 が `Success` になること）に委ね、CI では **軽量なファイル存在チェック**
 * のみを行う。詳細経緯は `Issue#81_実装メモ.md` の Phase 1 欄を参照。
 *
 * Red 段階では V22〜V25 の SQL ファイルが未作成のため、`classpath:db/migration`
 * 配下をスキャンしても該当ファイルが見つからず assertion が失敗する。
 *
 * 検証観点:
 *   1. V22/V23/V24/V25 のファイルが `backend/src/main/resources/db/migration/` に存在すること
 *   2. ファイル名が Flyway 命名規則 `V{version}__{description}.sql` に従っていること
 *   3. V15 は欠番（アーカイブで削除済み）なので存在しないこと
 */
class OAuthMigrationFilesTest {

    /** Flyway バージョン付きマイグレーションの命名規則: V{数字1つ以上}__{任意の文字列}.sql */
    private static final Pattern MIGRATION_NAME_PATTERN =
            Pattern.compile("^V(\\d+)__[A-Za-z0-9_]+\\.sql$");

    private static final Path MIGRATION_DIR =
            Paths.get("src/main/resources/db/migration");

    @Test
    @DisplayName("Issue#81 Phase 1: V22 マイグレーションファイルが存在する（users 列追加・password_hash NULLABLE 化想定）")
    void v22MigrationFileExists() {
        assertThat(findMigrationByVersion("22"))
                .as("V22__*.sql が db/migration/ に存在すること")
                .isPresent();
    }

    @Test
    @DisplayName("Issue#81 Phase 1: V23 マイグレーションファイルが存在する（user_oauth_connections テーブル新規想定）")
    void v23MigrationFileExists() {
        assertThat(findMigrationByVersion("23"))
                .as("V23__*.sql が db/migration/ に存在すること")
                .isPresent();
    }

    @Test
    @DisplayName("Issue#81 Phase 1: V24 マイグレーションファイルが存在する（OAuth 関連 INDEX 追加想定）")
    void v24MigrationFileExists() {
        assertThat(findMigrationByVersion("24"))
                .as("V24__*.sql が db/migration/ に存在すること")
                .isPresent();
    }

    @Test
    @DisplayName("Issue#81 Phase 1: V25 マイグレーションファイルが存在する（oauth_link_confirmations テーブル新規想定）")
    void v25MigrationFileExists() {
        assertThat(findMigrationByVersion("25"))
                .as("V25__*.sql が db/migration/ に存在すること")
                .isPresent();
    }

    @Test
    @DisplayName("Issue#81 Phase 1: V22〜V25 のファイル名が Flyway 命名規則 V{n}__{desc}.sql に従う")
    void oauthMigrationFilesFollowNamingConvention() {
        List<String> oauthMigrations = listMigrationFileNames().stream()
                .filter(name -> {
                    var matcher = MIGRATION_NAME_PATTERN.matcher(name);
                    if (!matcher.matches()) {
                        return false;
                    }
                    int version = Integer.parseInt(matcher.group(1));
                    return version >= 22 && version <= 25;
                })
                .sorted()
                .toList();

        assertThat(oauthMigrations)
                .as("V22〜V25 の 4 ファイル全てが命名規則にマッチすること")
                .hasSize(4);
    }

    @Test
    @DisplayName("Issue#81 Phase 1: V15 は欠番（アーカイブで削除済み）のためファイルが存在しない")
    void v15MigrationFileIsAbsent() {
        assertThat(findMigrationByVersion("15"))
                .as("V15 はアーカイブで削除済みのため存在しないこと")
                .isEmpty();
    }

    // ---------- ヘルパー ----------

    private java.util.Optional<Path> findMigrationByVersion(String version) {
        String prefix = "V" + version + "__";
        return listMigrationPaths().stream()
                .filter(p -> p.getFileName().toString().startsWith(prefix))
                .findFirst();
    }

    private List<String> listMigrationFileNames() {
        return listMigrationPaths().stream()
                .map(p -> p.getFileName().toString())
                .toList();
    }

    private List<Path> listMigrationPaths() {
        if (!Files.isDirectory(MIGRATION_DIR)) {
            throw new IllegalStateException(
                    "db/migration ディレクトリが存在しません: " + MIGRATION_DIR.toAbsolutePath());
        }
        try (Stream<Path> stream = Files.list(MIGRATION_DIR)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().endsWith(".sql"))
                    .toList();
        } catch (IOException e) {
            throw new RuntimeException("db/migration の列挙に失敗: " + e.getMessage(), e);
        }
    }
}
