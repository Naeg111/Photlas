package com.photlas.backend.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

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
}
