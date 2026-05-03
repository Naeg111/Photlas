package com.photlas.backend.service;

import com.photlas.backend.util.LanguageUtils;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Properties;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#113 - メール用 properties ファイルの整合性テスト。
 *
 * <p>5 言語のキー集合が完全一致することを検証する。1 つの言語にだけキーを追加し
 * 忘れたら本テストが失敗するので、キーの抜けを CI で検知できる。</p>
 *
 * <p>{@link LanguageUtils#SUPPORTED_LANGUAGES} に登録されているすべての言語に
 * 対応する properties ファイルが存在することも検証する。</p>
 */
class EmailTemplateConsistencyTest {

    @Test
    @DisplayName("Issue#113 - 5 言語の properties ファイルでキー集合が完全一致する")
    void allLanguagesHaveSameKeys() throws IOException {
        Set<String> jaKeys = loadKeys("messages_ja.properties");
        Set<String> enKeys = loadKeys("messages_en.properties");
        Set<String> koKeys = loadKeys("messages_ko.properties");
        Set<String> zhCnKeys = loadKeys("messages_zh_CN.properties");
        Set<String> zhTwKeys = loadKeys("messages_zh_TW.properties");

        assertThat(jaKeys).isEqualTo(enKeys);
        assertThat(koKeys).isEqualTo(enKeys);
        assertThat(zhCnKeys).isEqualTo(enKeys);
        assertThat(zhTwKeys).isEqualTo(enKeys);
    }

    @Test
    @DisplayName("Issue#113 - LanguageUtils.SUPPORTED_LANGUAGES の全言語にテンプレートファイルがある")
    void supportedLanguagesAllHaveTemplateFile() {
        for (String lang : LanguageUtils.SUPPORTED_LANGUAGES) {
            String filename = "messages_" + lang.replace("-", "_") + ".properties";
            assertThat(getClass().getResource("/i18n/email/" + filename))
                    .as("テンプレートファイルが見つかりません: %s", filename)
                    .isNotNull();
        }
    }

    @Test
    @DisplayName("Issue#113 - 全 5 言語に email.signature と email.verification.{subject,body} が存在する")
    void requiredKeysExistInAllLanguages() throws IOException {
        for (String lang : LanguageUtils.SUPPORTED_LANGUAGES) {
            String filename = "messages_" + lang.replace("-", "_") + ".properties";
            Set<String> keys = loadKeys(filename);
            assertThat(keys).as("%s に email.signature が必要", filename)
                    .contains("email.signature");
            assertThat(keys).as("%s に email.verification.subject が必要", filename)
                    .contains("email.verification.subject");
            assertThat(keys).as("%s に email.verification.body が必要", filename)
                    .contains("email.verification.body");
        }
    }

    private Set<String> loadKeys(String filename) throws IOException {
        Properties props = new Properties();
        try (InputStreamReader reader = new InputStreamReader(
                getClass().getResourceAsStream("/i18n/email/" + filename),
                StandardCharsets.UTF_8)) {
            props.load(reader);
        }
        return props.stringPropertyNames().stream().collect(Collectors.toSet());
    }
}
