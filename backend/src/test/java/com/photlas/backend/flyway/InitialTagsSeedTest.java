package com.photlas.backend.flyway;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#135 Phase 3: 初期キーワード語彙の投入マイグレーション（V36）の存在・内容チェック。
 *
 * <p>{@link OAuthMigrationFilesTest} と同じ理由で H2 上で Flyway 実行検証は行わず、
 * SQL ファイルの構造のみを確認する。</p>
 *
 * <p>検証観点:</p>
 * <ol>
 *   <li>V36 ファイルが存在</li>
 *   <li>tags への INSERT が 100 行以上（Issue#135 3.1 の「200〜500」の最低限）</li>
 *   <li>tag_categories への INSERT が含まれる</li>
 *   <li>代表的なキーワード（cherry-blossom, mountain, sushi 等）の slug が出てくる</li>
 *   <li>13 カテゴリ全ての category_code が tag_categories に出てくる</li>
 * </ol>
 */
class InitialTagsSeedTest {

    private static final Path MIGRATION_DIR =
            Paths.get("src/main/resources/db/migration");

    @Test
    @DisplayName("Issue#135 Phase 3: V36 マイグレーションファイルが存在する（initial tag seed 想定）")
    void v36MigrationFileExists() {
        assertThat(findMigrationByVersion("36"))
                .as("V36__*.sql が db/migration/ に存在すること")
                .isPresent();
    }

    @Test
    @DisplayName("Issue#135 Phase 3: V36 が tags への INSERT を 100 行以上含む（Issue 3.1 の最低限）")
    void v36ContainsAtLeastOneHundredTagInserts() {
        String content = readV36();

        long valuesRows = countValuesRows(content);
        assertThat(valuesRows)
                .as("INSERT INTO tags 系の VALUES 行が 100 以上 (実際: %d)", valuesRows)
                .isGreaterThanOrEqualTo(100);
    }

    @Test
    @DisplayName("Issue#135 Phase 3: V36 が tag_categories への INSERT を含む")
    void v36ContainsTagCategoriesInsert() {
        String content = readV36();

        assertThat(content)
                .containsIgnoringCase("INSERT INTO tag_categories");
    }

    @Test
    @DisplayName("Issue#135 Phase 3: V36 に代表的なキーワード slug (cherry-blossom / mountain / sushi 等) が含まれる")
    void v36ContainsRepresentativeTagSlugs() {
        String content = readV36();

        // 各カテゴリの代表的な keyword
        for (String slug : List.of(
                "mountain",         // 201 自然風景
                "city",             // 202 街並み
                "building",         // 203 建造物
                "illumination",     // 204 夜景
                "sushi",            // 205 グルメ
                "cherry-blossom",   // 206 植物
                "dog",              // 207 動物
                "eagle",            // 208 野鳥（+207）
                "car",              // 209 自動車
                "motorcycle",       // 210 バイク
                "train",            // 211 鉄道
                "airplane",         // 212 飛行機
                "milky-way"         // 213 星空
        )) {
            assertThat(content)
                    .as("代表 slug '%s' が V36 に含まれること", slug)
                    .contains("'" + slug + "'");
        }
    }

    @Test
    @DisplayName("Issue#135 Phase 3: V36 が 13 カテゴリ全ての category_code (201〜213) と紐付けを含む")
    void v36LinksAllThirteenCategories() {
        String content = readV36();

        for (int code = 201; code <= 213; code++) {
            assertThat(content)
                    .as("tag_categories に category_code %d の行が含まれること", code)
                    .contains(", " + code + ")");
        }
    }

    @Test
    @DisplayName("Issue#135 Phase 3: V36 の tags VALUES 行が 5 言語表示名カラムを埋めている (NULL や ' 抜けが無い)")
    void v36TagInsertsLooksWellFormed() {
        String content = readV36();
        // 1 行に少なくとも 5 個の '...' が含まれる事を期待（rekognition_label/slug + 5 言語 + sort_order を考慮し
        // それ以上の引用符を含む行が並んでいることを軽量に検証）
        long wellFormedRows = content.lines()
                .filter(line -> line.trim().startsWith("("))
                .filter(line -> countOccurrences(line, '\'') >= 10) // 5 文字列 * 2 引用符 = 10 以上
                .count();
        assertThat(wellFormedRows)
                .as("引用符を10個以上含む（=5言語以上のテキスト値を持つ）VALUES 行が 100 以上")
                .isGreaterThanOrEqualTo(100);
    }

    // ---------- ヘルパー ----------

    /** "(...)," または "(...);" 形式の VALUES 行（INSERT のレコード）を概算で数える。 */
    private long countValuesRows(String content) {
        return content.lines()
                .map(String::trim)
                .filter(s -> s.startsWith("("))
                .filter(s -> s.endsWith("),") || s.endsWith(");"))
                .count();
    }

    private int countOccurrences(String s, char c) {
        int count = 0;
        for (int i = 0; i < s.length(); i++) {
            if (s.charAt(i) == c) count++;
        }
        return count;
    }

    private String readV36() {
        Path v36 = findMigrationByVersion("36")
                .orElseThrow(() -> new AssertionError("V36__*.sql が見つかりません"));
        try {
            return Files.readString(v36);
        } catch (IOException e) {
            throw new RuntimeException("V36 マイグレーション読み取り失敗: " + e.getMessage(), e);
        }
    }

    private Optional<Path> findMigrationByVersion(String version) {
        String prefix = "V" + version + "__";
        try (Stream<Path> stream = Files.list(MIGRATION_DIR)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().startsWith(prefix))
                    .filter(p -> p.getFileName().toString().endsWith(".sql"))
                    .findFirst();
        } catch (IOException e) {
            throw new RuntimeException("db/migration の列挙に失敗: " + e.getMessage(), e);
        }
    }
}
