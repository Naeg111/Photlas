package com.photlas.backend.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#93: LanguageUtils 5言語対応テスト
 */
public class LanguageUtilsTest {

    @Test
    @DisplayName("Issue#93 - 韓国語のAccept-Languageが ko に解決される")
    void testResolve_Korean_ReturnsKo() {
        assertThat(LanguageUtils.resolve("ko")).isEqualTo("ko");
        assertThat(LanguageUtils.resolve("ko-KR")).isEqualTo("ko");
    }

    @Test
    @DisplayName("Issue#93 - 中国語簡体字のAccept-Languageが zh-CN に解決される")
    void testResolve_ChineseSimplified_ReturnsZhCN() {
        assertThat(LanguageUtils.resolve("zh-CN")).isEqualTo("zh-CN");
        assertThat(LanguageUtils.resolve("zh-CN,zh;q=0.9")).isEqualTo("zh-CN");
    }

    @Test
    @DisplayName("Issue#93 - 中国語繁体字のAccept-Languageが zh-TW に解決される")
    void testResolve_ChineseTraditional_ReturnsZhTW() {
        assertThat(LanguageUtils.resolve("zh-TW")).isEqualTo("zh-TW");
        assertThat(LanguageUtils.resolve("zh-TW,zh;q=0.9")).isEqualTo("zh-TW");
    }

    @Test
    @DisplayName("Issue#93 - 中国語（地域指定なし）のAccept-Languageが zh-CN に解決される")
    void testResolve_ChineseGeneric_ReturnsZhCN() {
        assertThat(LanguageUtils.resolve("zh")).isEqualTo("zh-CN");
    }

    @Test
    @DisplayName("Issue#93 - 日本語のAccept-Languageが ja に解決される")
    void testResolve_Japanese_ReturnsJa() {
        assertThat(LanguageUtils.resolve("ja")).isEqualTo("ja");
        assertThat(LanguageUtils.resolve("ja-JP")).isEqualTo("ja");
    }

    @Test
    @DisplayName("Issue#93 - 英語のAccept-Languageが en に解決される")
    void testResolve_English_ReturnsEn() {
        assertThat(LanguageUtils.resolve("en")).isEqualTo("en");
        assertThat(LanguageUtils.resolve("en-US,en;q=0.9")).isEqualTo("en");
    }

    @Test
    @DisplayName("Issue#93 - 未対応言語のAccept-Languageが en にフォールバックする")
    void testResolve_UnsupportedLanguage_FallsBackToEn() {
        assertThat(LanguageUtils.resolve("fr-FR")).isEqualTo("en");
        assertThat(LanguageUtils.resolve("de")).isEqualTo("en");
        assertThat(LanguageUtils.resolve("th")).isEqualTo("en");
    }

    @Test
    @DisplayName("Issue#93 - null/空文字のAccept-Languageが ja にフォールバックする")
    void testResolve_NullOrBlank_ReturnsJa() {
        assertThat(LanguageUtils.resolve(null)).isEqualTo("ja");
        assertThat(LanguageUtils.resolve("")).isEqualTo("ja");
        assertThat(LanguageUtils.resolve("  ")).isEqualTo("ja");
    }

    @ParameterizedTest(name = "{0} → {1}")
    @CsvSource(delimiter = '|', value = {
            "zh-HK | zh-TW",
            "zh-MO | zh-TW",
            "zh-Hant | zh-TW",
            "zh-Hant-TW | zh-TW",
            "zh-Hant-HK | zh-TW",
            "zh-tw | zh-TW",
            "zh_TW | zh-TW",
            "'zh-HK,zh;q=0.9,en;q=0.8' | zh-TW",
            "zh-SG | zh-CN",
            "zh-Hans | zh-CN",
            "zh-Hans-CN | zh-CN",
            "zh-Hans-HK | zh-CN",
            "'zh,en;q=0.8' | zh-CN",
    })
    @DisplayName("Spec#93 - 中国語は繁体（Hant）か台湾・香港・マカオなら zh-TW、それ以外は zh-CN（フロントと同じ判定）")
    void testResolve_ChineseVariants(String acceptLanguage, String expected) {
        assertThat(LanguageUtils.resolve(acceptLanguage)).isEqualTo(expected);
    }

    @Test
    @DisplayName("Spec#93 - 先頭の言語タグで判定する（2 番目以降は見ない）")
    void testResolve_UsesFirstTagOnly() {
        assertThat(LanguageUtils.resolve("fr-FR,ja;q=0.9")).isEqualTo("en");
        assertThat(LanguageUtils.resolve("ko;q=1.0,ja;q=0.9")).isEqualTo("ko");
    }

    @Test
    @DisplayName("Spec#93 - 区切り文字だけの値でも例外にせず en にする")
    void testResolve_SeparatorsOnly_FallsBackToEn() {
        assertThat(LanguageUtils.resolve(",")).isEqualTo("en");
        assertThat(LanguageUtils.resolve(";")).isEqualTo("en");
        assertThat(LanguageUtils.resolve("-")).isEqualTo("en");
        assertThat(LanguageUtils.resolve("*")).isEqualTo("en");
    }
}
