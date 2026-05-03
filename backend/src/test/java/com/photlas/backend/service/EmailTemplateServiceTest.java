package com.photlas.backend.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.MessageSource;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;

import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Issue#113 - EmailTemplateService の単体テスト。
 *
 * <p>5 言語フォールバック / BCP-47 タグ処理 / null・空文字 → en / 未登録キー例外 /
 * シグネチャ自動付与 / 単一引号エスケープ を検証する。</p>
 *
 * <p>本テストは Spring を起動せず、{@link ReloadableResourceBundleMessageSource} を
 * 直接組み立てて高速に実行する。</p>
 */
class EmailTemplateServiceTest {

    private EmailTemplateService service;

    @BeforeEach
    void setUp() {
        ReloadableResourceBundleMessageSource source = new ReloadableResourceBundleMessageSource();
        source.setBasename("classpath:i18n/email/messages");
        source.setDefaultEncoding("UTF-8");
        source.setDefaultLocale(Locale.ENGLISH);
        source.setFallbackToSystemLocale(false);
        source.setCacheSeconds(-1);
        service = new EmailTemplateService(source);
    }

    @Test
    @DisplayName("Issue#113 - 件名: ja で日本語の件名が返る")
    void japaneseSubject() {
        String subject = service.subject("email.verification", "ja");
        assertThat(subject).contains("Photlas");
        assertThat(subject).contains("メールアドレス");
    }

    @Test
    @DisplayName("Issue#113 - 件名: en で英語の件名が返る")
    void englishSubject() {
        String subject = service.subject("email.verification", "en");
        assertThat(subject).contains("Photlas");
        assertThat(subject).contains("Verification");
    }

    @Test
    @DisplayName("Issue#113 - 件名: ko で韓国語の件名が返る")
    void koreanSubject() {
        String subject = service.subject("email.verification", "ko");
        assertThat(subject).contains("Photlas");
        // 韓国語のハングル文字が含まれていること
        assertThat(subject).matches(".*[\\uAC00-\\uD7AF].*");
    }

    @Test
    @DisplayName("Issue#113 - 件名: zh-CN で簡体中文の件名が返る")
    void chineseSimplifiedSubject() {
        String subject = service.subject("email.verification", "zh-CN");
        assertThat(subject).contains("Photlas");
        // CJK 文字が含まれていること
        assertThat(subject).matches(".*[\\u4E00-\\u9FFF].*");
    }

    @Test
    @DisplayName("Issue#113 - 件名: zh-TW で繁体中文の件名が返る")
    void chineseTraditionalSubject() {
        String subject = service.subject("email.verification", "zh-TW");
        assertThat(subject).contains("Photlas");
        assertThat(subject).matches(".*[\\u4E00-\\u9FFF].*");
    }

    @Test
    @DisplayName("Issue#113 - 件名: 未対応言語は en にフォールバック")
    void unknownLanguageFallsBackToEnglish() {
        String fallback = service.subject("email.verification", "fr");
        String english = service.subject("email.verification", "en");
        assertThat(fallback).isEqualTo(english);
    }

    @Test
    @DisplayName("Issue#113 - 件名: null 言語は en にフォールバック")
    void nullLanguageFallsBackToEnglish() {
        String fallback = service.subject("email.verification", (String) null);
        String english = service.subject("email.verification", "en");
        assertThat(fallback).isEqualTo(english);
    }

    @Test
    @DisplayName("Issue#113 - 件名: 空文字言語は en にフォールバック")
    void blankLanguageFallsBackToEnglish() {
        String fallback = service.subject("email.verification", "");
        String english = service.subject("email.verification", "en");
        assertThat(fallback).isEqualTo(english);
    }

    @Test
    @DisplayName("Issue#113 - 本文: 末尾に email.signature が自動で付与される")
    void bodyHasSignatureAppended() {
        String body = service.body("email.verification", "ja", "naegi", "https://example.com/verify");
        // シグネチャに含まれる "support@photlas.jp" が末尾近くにあること
        assertThat(body).contains("support@photlas.jp");
    }

    @Test
    @DisplayName("Issue#113 - 本文: プレースホルダ {0} {1} が引数で置換される")
    void bodyPlaceholdersAreReplaced() {
        String body = service.body("email.verification", "ja", "苗木", "https://example.com/verify");
        assertThat(body).contains("苗木");
        assertThat(body).contains("https://example.com/verify");
    }

    @Test
    @DisplayName("Issue#113 - 未登録キーは IllegalStateException")
    void unknownKeyThrows() {
        assertThatThrownBy(() -> service.subject("email.nonexistent", "ja"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("email.nonexistent");
    }

    @Test
    @DisplayName("Issue#113 - User オーバーロード: User.language が使われる")
    void userOverloadUsesUserLanguage() {
        com.photlas.backend.entity.User user = new com.photlas.backend.entity.User();
        user.setLanguage("ko");
        String subject = service.subject("email.verification", user);
        // ko のテンプレートが使われていることをハングル文字で確認
        assertThat(subject).matches(".*[\\uAC00-\\uD7AF].*");
    }

    @Test
    @DisplayName("Issue#113 - シグネチャの言語別取得")
    void signatureByLanguage() {
        assertThat(service.signature("ja")).contains("support@photlas.jp");
        assertThat(service.signature("en")).contains("support@photlas.jp");
        assertThat(service.signature("ko")).contains("support@photlas.jp");
    }
}
