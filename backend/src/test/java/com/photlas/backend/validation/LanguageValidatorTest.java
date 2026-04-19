package com.photlas.backend.validation;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#81 Phase 2 - LanguageValidator のテスト
 *
 * Round 7 決定: `lang` パラメータのホワイトリスト検証を集約するユーティリティ。
 * サポート言語（ja, en, ko, zh-CN, zh-TW）以外は拒否する。
 * null / 空文字はデフォルト値にフォールバックする（呼び出し側で扱う）。
 */
class LanguageValidatorTest {

    @Test
    @DisplayName("Issue#81 - サポート言語（ja）は有効と判定される")
    void japaneseIsValid() {
        assertThat(LanguageValidator.isValid("ja")).isTrue();
    }

    @Test
    @DisplayName("Issue#81 - サポート言語（en）は有効と判定される")
    void englishIsValid() {
        assertThat(LanguageValidator.isValid("en")).isTrue();
    }

    @Test
    @DisplayName("Issue#81 - サポート言語（ko）は有効と判定される")
    void koreanIsValid() {
        assertThat(LanguageValidator.isValid("ko")).isTrue();
    }

    @Test
    @DisplayName("Issue#81 - サポート言語（zh-CN）は有効と判定される")
    void chineseSimplifiedIsValid() {
        assertThat(LanguageValidator.isValid("zh-CN")).isTrue();
    }

    @Test
    @DisplayName("Issue#81 - サポート言語（zh-TW）は有効と判定される")
    void chineseTraditionalIsValid() {
        assertThat(LanguageValidator.isValid("zh-TW")).isTrue();
    }

    @Test
    @DisplayName("Issue#81 - 未サポート言語（fr）は無効と判定される")
    void unsupportedLanguageIsInvalid() {
        assertThat(LanguageValidator.isValid("fr")).isFalse();
    }

    @Test
    @DisplayName("Issue#81 - null は無効と判定される（呼び出し側でデフォルト適用）")
    void nullIsInvalid() {
        assertThat(LanguageValidator.isValid(null)).isFalse();
    }

    @Test
    @DisplayName("Issue#81 - 空文字は無効と判定される")
    void emptyStringIsInvalid() {
        assertThat(LanguageValidator.isValid("")).isFalse();
    }

    @Test
    @DisplayName("Issue#81 - 大文字混在（JA）は無効と判定される（完全一致で検証する厳格モード）")
    void upperCaseIsInvalid() {
        assertThat(LanguageValidator.isValid("JA")).isFalse();
    }

    @Test
    @DisplayName("Issue#81 - サニタイズで未知言語は ja にフォールバックする")
    void sanitizeUnknownLanguageReturnsDefault() {
        assertThat(LanguageValidator.sanitize("fr")).isEqualTo("ja");
    }

    @Test
    @DisplayName("Issue#81 - サニタイズで null は ja にフォールバックする")
    void sanitizeNullReturnsDefault() {
        assertThat(LanguageValidator.sanitize(null)).isEqualTo("ja");
    }

    @Test
    @DisplayName("Issue#81 - サニタイズでサポート言語はそのまま返る")
    void sanitizeValidLanguagePassesThrough() {
        assertThat(LanguageValidator.sanitize("en")).isEqualTo("en");
        assertThat(LanguageValidator.sanitize("zh-TW")).isEqualTo("zh-TW");
    }
}
