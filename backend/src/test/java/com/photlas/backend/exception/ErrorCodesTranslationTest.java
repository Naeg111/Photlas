package com.photlas.backend.exception;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Spec#93: バックエンドのエラーコードと、フロントエンドの翻訳（{@code errors.<code>}）を突き合わせる。
 *
 * <p>フロントは翻訳の無いコードを画面ごとの汎用文言で表示するため、コードを足して翻訳を忘れても
 * 画面では気づけない。ここで 5 言語すべてに翻訳があることを確かめる。
 */
class ErrorCodesTranslationTest {

    /** Gradle はテストを backend ディレクトリで実行する */
    private static final Path LOCALES_DIR = Path.of("..", "frontend", "src", "i18n", "locales");

    /** フロントで {@code errors.<code>} を引かないコード */
    private static final Set<String> NOT_TRANSLATED = Set.of(
            // 画面ごとの汎用文言（「エラーが発生しました」等）で表示する
            ErrorCodes.VALIDATION_ERROR,
            ErrorCodes.BAD_REQUEST,
            ErrorCodes.INTERNAL_ERROR,
            // アカウント設定のデータエクスポートが settings.* の専用文言（次に使える日時入り）で表示する
            ErrorCodes.EXPORT_IN_PROGRESS,
            ErrorCodes.EXPORT_RATE_LIMITED);

    private static List<Field> codeFields() {
        List<Field> fields = new ArrayList<>();
        for (Field field : ErrorCodes.class.getDeclaredFields()) {
            int modifiers = field.getModifiers();
            if (Modifier.isPublic(modifiers) && Modifier.isStatic(modifiers)
                    && Modifier.isFinal(modifiers) && field.getType() == String.class) {
                fields.add(field);
            }
        }
        return fields;
    }

    private static List<String> codes() throws IllegalAccessException {
        List<String> codes = new ArrayList<>();
        for (Field field : codeFields()) {
            codes.add((String) field.get(null));
        }
        return codes;
    }

    @Test
    @DisplayName("Spec#93 - コードは英大文字とアンダースコアだけ（i18next のキーの区切り . や : を含まない）")
    void codesUseUpperSnakeCaseOnly() throws IllegalAccessException {
        for (String code : codes()) {
            assertThat(code).as(code).matches("[A-Z][A-Z_]*");
        }
    }

    @Test
    @DisplayName("Spec#93 - 定数名とコードの値が一致する")
    void constantNameEqualsValue() throws IllegalAccessException {
        List<Field> fields = codeFields();
        assertThat(fields).isNotEmpty();
        for (Field field : fields) {
            assertThat(field.get(null)).as(field.getName()).isEqualTo(field.getName());
        }
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"ja", "en", "ko", "zh-CN", "zh-TW"})
    @DisplayName("Spec#93 - 汎用のコードを除くすべてのコードに errors.<code> の翻訳がある")
    void everyCodeHasTranslation(String language) throws IOException, IllegalAccessException {
        Path file = LOCALES_DIR.resolve(language + ".json");
        assertThat(Files.exists(file)).as("翻訳ファイル %s", file.toAbsolutePath()).isTrue();

        JsonNode errors = new ObjectMapper().readTree(file.toFile()).path("errors");

        List<String> missing = new ArrayList<>();
        for (String code : codes()) {
            if (NOT_TRANSLATED.contains(code)) {
                continue;
            }
            JsonNode text = errors.get(code);
            if (text == null || !text.isTextual() || text.asText().isBlank()) {
                missing.add(code);
            }
        }
        assertThat(missing).as("%s.json に errors.<code> が無いコード", language).isEmpty();
    }
}
