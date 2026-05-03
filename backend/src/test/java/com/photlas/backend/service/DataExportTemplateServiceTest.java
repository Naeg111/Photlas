package com.photlas.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.ZoneId;
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#108 §4.19 / §4.12 - README.md と通知メールの多言語テンプレート読み込みのテスト。
 *
 * 要件:
 *   - README.md は 5 言語（ja / en / ko / zh / th）すべてで生成できる
 *   - README.md にはユーザー名・エクスポート日時のプレースホルダが埋め込まれる
 *   - エクスポート日時はユーザー言語のタイムゾーン表示で出力される
 *   - 通知メールの件名・本文も 5 言語に対応する
 *   - 未対応言語の場合は en（フォールバック）が使われる
 */
@SpringBootTest
@ActiveProfiles("test")
class DataExportTemplateServiceTest {

    @Autowired
    private DataExportTemplateService dataExportTemplateService;

    private static final ZonedDateTime EXPORTED_AT_UTC =
            ZonedDateTime.of(2026, 5, 3, 5, 30, 0, 0, ZoneId.of("UTC"));

    @Test
    @DisplayName("Issue#108 - README.md が日本語で生成される")
    void renderReadmeJa() {
        String readme = dataExportTemplateService.renderReadme("ja", "苗木", EXPORTED_AT_UTC);

        assertThat(readme).contains("Photlas");
        assertThat(readme).contains("エクスポート");
        assertThat(readme).contains("苗木");
        // ja のタイムゾーン JST で出力される（UTC 05:30 → JST 14:30）
        assertThat(readme).contains("14:30");
        assertThat(readme).contains("JST");
    }

    @Test
    @DisplayName("Issue#108 - README.md が英語で生成される")
    void renderReadmeEn() {
        String readme = dataExportTemplateService.renderReadme("en", "naegi", EXPORTED_AT_UTC);

        assertThat(readme).contains("Photlas");
        assertThat(readme).contains("Export");
        assertThat(readme).contains("naegi");
        assertThat(readme).contains("UTC");
    }

    @Test
    @DisplayName("Issue#108 - README.md が韓国語で生成される")
    void renderReadmeKo() {
        String readme = dataExportTemplateService.renderReadme("ko", "naegi", EXPORTED_AT_UTC);
        assertThat(readme).contains("Photlas");
        assertThat(readme).contains("naegi");
        assertThat(readme).contains("KST");
    }

    @Test
    @DisplayName("Issue#108 - README.md が中国語で生成される")
    void renderReadmeZh() {
        String readme = dataExportTemplateService.renderReadme("zh", "naegi", EXPORTED_AT_UTC);
        assertThat(readme).contains("Photlas");
        assertThat(readme).contains("naegi");
        assertThat(readme).contains("CST");
    }

    @Test
    @DisplayName("Issue#108 - README.md がタイ語で生成される")
    void renderReadmeTh() {
        String readme = dataExportTemplateService.renderReadme("th", "naegi", EXPORTED_AT_UTC);
        assertThat(readme).contains("Photlas");
        assertThat(readme).contains("naegi");
        assertThat(readme).contains("ICT");
    }

    @Test
    @DisplayName("Issue#108 - 未対応言語は en にフォールバック")
    void renderReadmeUnknownFallsBackToEn() {
        String fallback = dataExportTemplateService.renderReadme("fr", "naegi", EXPORTED_AT_UTC);
        String englishReadme = dataExportTemplateService.renderReadme("en", "naegi", EXPORTED_AT_UTC);
        assertThat(fallback).isEqualTo(englishReadme);
    }

    @Test
    @DisplayName("Issue#108 - 通知メール件名が 5 言語で生成される")
    void emailSubjectIsLocalized() {
        assertThat(dataExportTemplateService.renderEmailSubject("ja"))
                .contains("Photlas").contains("エクスポート");
        assertThat(dataExportTemplateService.renderEmailSubject("en"))
                .contains("Photlas").contains("Export");
        assertThat(dataExportTemplateService.renderEmailSubject("ko"))
                .contains("Photlas");
        assertThat(dataExportTemplateService.renderEmailSubject("zh"))
                .contains("Photlas");
        assertThat(dataExportTemplateService.renderEmailSubject("th"))
                .contains("Photlas");
    }

    @Test
    @DisplayName("Issue#108 - 通知メール本文に IP / User-Agent / 完了日時が含まれる")
    void emailBodyContainsRequestInfo() {
        String body = dataExportTemplateService.renderEmailBody(
                "ja", "苗木", EXPORTED_AT_UTC, "192.0.2.1", "Mozilla/5.0");

        assertThat(body).contains("苗木");
        assertThat(body).contains("192.0.2.1");
        assertThat(body).contains("Mozilla/5.0");
        assertThat(body).contains("14:30"); // JST 表記
        assertThat(body).contains("JST");
        // 乗っ取り検知の文言（support 案内）が含まれる
        assertThat(body).contains("support@photlas.jp");
    }

    @Test
    @DisplayName("Issue#108 - 通知メール本文も未対応言語は en にフォールバック")
    void emailBodyUnknownFallsBackToEn() {
        String fallback = dataExportTemplateService.renderEmailBody(
                "fr", "naegi", EXPORTED_AT_UTC, "192.0.2.1", "Mozilla/5.0");
        String english = dataExportTemplateService.renderEmailBody(
                "en", "naegi", EXPORTED_AT_UTC, "192.0.2.1", "Mozilla/5.0");
        assertThat(fallback).isEqualTo(english);
    }
}
