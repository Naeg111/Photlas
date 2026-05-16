package com.photlas.backend.flyway;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#135 Phase 1 Red: キーワード機能の DB マイグレーションファイル存在・内容チェック。
 *
 * <p>V9 以降の PostgreSQL 専用構文の関係で H2 で Flyway 実行検証は行えないため
 * （{@link OAuthMigrationFilesTest} 参照）、CI では軽量なファイル存在・内容チェックのみ行う。</p>
 *
 * <p>検証観点:</p>
 * <ol>
 *   <li>V35 のファイルが存在すること（命名規則 {@code V{version}__{description}.sql}）</li>
 *   <li>3 つの新規テーブル（tags / tag_categories / photo_tags）の DDL が含まれていること</li>
 *   <li>主要カラム（slug / display_name_en / assigned_by / is_active 等）が定義されていること</li>
 *   <li>外部キーの ON DELETE 動作が Issue#135 4.1 設計通りであること
 *       （photo_tags.photo_id=CASCADE, photo_tags.tag_id=RESTRICT, tag_categories.tag_id=CASCADE）</li>
 *   <li>インデックスが含まれていること</li>
 * </ol>
 */
class TagsMigrationFilesTest {

    /** Flyway バージョン付きマイグレーションの命名規則。 */
    private static final Pattern MIGRATION_NAME_PATTERN =
            Pattern.compile("^V(\\d+)__[A-Za-z0-9_]+\\.sql$");

    private static final Path MIGRATION_DIR =
            Paths.get("src/main/resources/db/migration");

    @Test
    @DisplayName("Issue#135 Phase 1: V35 マイグレーションファイルが存在する（tags / tag_categories / photo_tags 新規想定）")
    void v35MigrationFileExists() {
        assertThat(findMigrationByVersion("35"))
                .as("V35__*.sql が db/migration/ に存在すること")
                .isPresent();
    }

    @Test
    @DisplayName("Issue#135 Phase 1: V35 のファイル名が命名規則 V{n}__{desc}.sql に従う")
    void v35MigrationFileFollowsNamingConvention() {
        Optional<Path> v35 = findMigrationByVersion("35");
        assertThat(v35).isPresent();
        String name = v35.get().getFileName().toString();
        assertThat(MIGRATION_NAME_PATTERN.matcher(name).matches())
                .as("ファイル名 '%s' が V{n}__{desc}.sql 形式に従うこと", name)
                .isTrue();
    }

    @Test
    @DisplayName("Issue#135 Phase 1: V35 に tags / tag_categories / photo_tags テーブル定義が含まれる")
    void v35DefinesAllThreeTables() {
        String content = readV35();

        assertThat(content)
                .as("tags テーブルの CREATE 文を含むこと")
                .containsIgnoringCase("CREATE TABLE")
                .containsIgnoringCase("tags");
        assertThat(content).contains("tag_categories");
        assertThat(content).contains("photo_tags");
    }

    @Test
    @DisplayName("Issue#135 Phase 1: V35 で tags テーブルに主要カラム (rekognition_label/slug/display_name_*/sort_order/is_active) が定義される")
    void v35TagsTableHasRequiredColumns() {
        String content = readV35();

        assertThat(content).contains("rekognition_label");
        assertThat(content).contains("slug");
        assertThat(content).contains("display_name_ja");
        assertThat(content).contains("display_name_en");
        assertThat(content).contains("display_name_zh");
        assertThat(content).contains("display_name_ko");
        assertThat(content).contains("display_name_es");
        assertThat(content).contains("sort_order");
        assertThat(content).contains("is_active");
    }

    @Test
    @DisplayName("Issue#135 Phase 1: V35 で photo_tags が assigned_by / ai_confidence カラムを持つ")
    void v35PhotoTagsHasAssignedByAndConfidence() {
        String content = readV35();

        assertThat(content).contains("assigned_by");
        assertThat(content).contains("ai_confidence");
    }

    @Test
    @DisplayName("Issue#135 Phase 1: V35 の photo_tags.photo_id は ON DELETE CASCADE")
    void v35PhotoTagsPhotoIdCascadeOnDelete() {
        String content = readV35();
        // photo_id 外部キーが CASCADE であることを確認（同一行 or 隣接行）
        assertThat(content)
                .as("photo_tags.photo_id REFERENCES photos ... ON DELETE CASCADE が含まれること")
                .containsPattern("(?is)photo_id[^,]*REFERENCES\\s+photos\\b[^,]*ON\\s+DELETE\\s+CASCADE");
    }

    @Test
    @DisplayName("Issue#135 Phase 1: V35 の photo_tags.tag_id は ON DELETE RESTRICT")
    void v35PhotoTagsTagIdRestrictOnDelete() {
        String content = readV35();
        assertThat(content)
                .as("photo_tags.tag_id REFERENCES tags ... ON DELETE RESTRICT が含まれること")
                .containsPattern("(?is)tag_id[^,]*REFERENCES\\s+tags\\b[^,]*ON\\s+DELETE\\s+RESTRICT");
    }

    @Test
    @DisplayName("Issue#135 Phase 1: V35 の tag_categories.tag_id は ON DELETE CASCADE")
    void v35TagCategoriesTagIdCascadeOnDelete() {
        String content = readV35();
        assertThat(content)
                .as("tag_categories.tag_id REFERENCES tags ... ON DELETE CASCADE が含まれること")
                .containsPattern("(?is)tag_id[^,]*REFERENCES\\s+tags\\b[^,]*ON\\s+DELETE\\s+CASCADE");
    }

    @Test
    @DisplayName("Issue#135 Phase 1: V35 でインデックス (slug / photo_tags.tag_id / tag_categories.category_code) が作成される")
    void v35DefinesIndexes() {
        String content = readV35();

        assertThat(content).containsIgnoringCase("CREATE INDEX");
        // 個別インデックスの存在は内容で判別
        assertThat(content).containsIgnoringCase("slug");
        assertThat(content).containsPattern("(?is)INDEX[^;]+photo_tags[^;]+tag_id");
        assertThat(content).containsPattern("(?is)INDEX[^;]+tag_categories[^;]+category_code");
    }

    // ---------- ヘルパー ----------

    private String readV35() {
        Path v35 = findMigrationByVersion("35")
                .orElseThrow(() -> new AssertionError("V35__*.sql が見つかりません"));
        try {
            return Files.readString(v35);
        } catch (IOException e) {
            throw new RuntimeException("V35 マイグレーションファイル読み取りに失敗: " + e.getMessage(), e);
        }
    }

    private Optional<Path> findMigrationByVersion(String version) {
        String prefix = "V" + version + "__";
        return listMigrationPaths().stream()
                .filter(p -> p.getFileName().toString().startsWith(prefix))
                .findFirst();
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
