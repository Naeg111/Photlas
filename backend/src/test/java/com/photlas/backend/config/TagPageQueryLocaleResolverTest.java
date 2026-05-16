package com.photlas.backend.config;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Issue#136 Phase 1: {@link TagPageQueryLocaleResolver} の単体テスト。
 *
 * <p>?lang=xx クエリパラメータを Spring の {@link Locale} に変換するカスタム resolver。
 * Q20 で決定: 非正規・未サポートの lang コードも canonical (en/ja/zh/ko/es) に正規化する。</p>
 */
class TagPageQueryLocaleResolverTest {

    private final TagPageQueryLocaleResolver resolver = new TagPageQueryLocaleResolver();

    // ========== canonicalize() static method ==========

    @Test
    @DisplayName("Issue#136 - canonicalize: SUPPORTED に完全一致なら そのまま")
    void canonicalize_exactMatch_returnsAsIs() {
        assertThat(TagPageQueryLocaleResolver.canonicalize("en")).isEqualTo("en");
        assertThat(TagPageQueryLocaleResolver.canonicalize("ja")).isEqualTo("ja");
        assertThat(TagPageQueryLocaleResolver.canonicalize("zh")).isEqualTo("zh");
        assertThat(TagPageQueryLocaleResolver.canonicalize("ko")).isEqualTo("ko");
        assertThat(TagPageQueryLocaleResolver.canonicalize("es")).isEqualTo("es");
    }

    @Test
    @DisplayName("Issue#136 - canonicalize: 大文字小文字混在も lowercase 正規化")
    void canonicalize_caseInsensitive() {
        assertThat(TagPageQueryLocaleResolver.canonicalize("EN")).isEqualTo("en");
        assertThat(TagPageQueryLocaleResolver.canonicalize("Ja")).isEqualTo("ja");
        assertThat(TagPageQueryLocaleResolver.canonicalize("ZH")).isEqualTo("zh");
    }

    @Test
    @DisplayName("Issue#136 - canonicalize: zh-TW / zh-CN / zh-Hans は base lang の zh に正規化")
    void canonicalize_chineseVariants_normalizedToZh() {
        assertThat(TagPageQueryLocaleResolver.canonicalize("zh-TW")).isEqualTo("zh");
        assertThat(TagPageQueryLocaleResolver.canonicalize("zh-CN")).isEqualTo("zh");
        assertThat(TagPageQueryLocaleResolver.canonicalize("zh-Hans")).isEqualTo("zh");
        assertThat(TagPageQueryLocaleResolver.canonicalize("zh_TW")).isEqualTo("zh");
        assertThat(TagPageQueryLocaleResolver.canonicalize("ZH-tw")).isEqualTo("zh");
    }

    @Test
    @DisplayName("Issue#136 - canonicalize: en-US / ja-JP も base lang に正規化")
    void canonicalize_otherRegionVariants() {
        assertThat(TagPageQueryLocaleResolver.canonicalize("en-US")).isEqualTo("en");
        assertThat(TagPageQueryLocaleResolver.canonicalize("ja-JP")).isEqualTo("ja");
        assertThat(TagPageQueryLocaleResolver.canonicalize("ko-KR")).isEqualTo("ko");
        assertThat(TagPageQueryLocaleResolver.canonicalize("es-ES")).isEqualTo("es");
    }

    @Test
    @DisplayName("Issue#136 - canonicalize: 完全未サポートは null（呼び出し側が default にフォールバック）")
    void canonicalize_unsupported_returnsNull() {
        assertThat(TagPageQueryLocaleResolver.canonicalize("fr")).isNull();
        assertThat(TagPageQueryLocaleResolver.canonicalize("de-DE")).isNull();
        assertThat(TagPageQueryLocaleResolver.canonicalize("xyz")).isNull();
    }

    @Test
    @DisplayName("Issue#136 - canonicalize: null / 空文字列 / 空白も null")
    void canonicalize_nullOrBlank_returnsNull() {
        assertThat(TagPageQueryLocaleResolver.canonicalize(null)).isNull();
        assertThat(TagPageQueryLocaleResolver.canonicalize("")).isNull();
        assertThat(TagPageQueryLocaleResolver.canonicalize("   ")).isNull();
    }

    // ========== resolveLocale() ==========

    @Test
    @DisplayName("Issue#136 - resolveLocale: ?lang=ja → Locale.JAPANESE 相当")
    void resolveLocale_japanese() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getParameter("lang")).thenReturn("ja");

        Locale locale = resolver.resolveLocale(request);

        assertThat(locale.toString()).isEqualTo("ja");
    }

    @Test
    @DisplayName("Issue#136 - resolveLocale: ?lang=zh-TW → zh Locale (canonicalize)")
    void resolveLocale_chineseRegionalVariant_normalizedToZh() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getParameter("lang")).thenReturn("zh-TW");

        Locale locale = resolver.resolveLocale(request);

        assertThat(locale.toString()).isEqualTo("zh");
    }

    @Test
    @DisplayName("Issue#136 - resolveLocale: ?lang 未指定 → English (default)")
    void resolveLocale_missingLang_returnsEnglish() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getParameter("lang")).thenReturn(null);

        Locale locale = resolver.resolveLocale(request);

        assertThat(locale).isEqualTo(Locale.ENGLISH);
    }

    @Test
    @DisplayName("Issue#136 - resolveLocale: 完全未サポート (?lang=fr) → English (default フォールバック)")
    void resolveLocale_unsupported_returnsEnglish() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getParameter("lang")).thenReturn("fr");

        Locale locale = resolver.resolveLocale(request);

        assertThat(locale).isEqualTo(Locale.ENGLISH);
    }

    @Test
    @DisplayName("Issue#136 - setLocale: no-op で例外を投げない（request-scoped なので保存先無し）")
    void setLocale_isNoOp() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        // 例外を投げないことを確認
        resolver.setLocale(request, null, Locale.JAPANESE);
    }
}
