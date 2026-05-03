package com.photlas.backend.service;

import com.photlas.backend.util.TimeZoneResolver;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Issue#108 §4.19 / §4.12: ZIP 内 README.md と通知メールの多言語テンプレート生成サービス。
 *
 * <p>README.md は {@code src/main/resources/templates/data-export/readme/readme_{lang}.md}
 * から読み込み、簡易プレースホルダ（{@code {{username}}} / {@code {{exportedAt}}}）を
 * 埋め込む。通知メールは件名・本文ともインライン文字列（既存の
 * {@link ModerationNotificationService} と同じパターン）。</p>
 *
 * <p>サポート言語: ja / en / ko / zh / th。未対応言語は en へフォールバックする。</p>
 */
@Service
public class DataExportTemplateService {

    private static final Set<String> SUPPORTED_LANGUAGES = Set.of("ja", "en", "ko", "zh", "th");
    private static final String FALLBACK_LANGUAGE = "en";

    /**
     * README.md をユーザー言語で生成する。
     *
     * @param language   ユーザー言語コード（"ja" / "en" / "ko" / "zh" / "th"）
     * @param username   ユーザー表示名
     * @param exportedAt エクスポート完了日時（タイムゾーン付き、UTC でも JST でも可）
     * @return プレースホルダ展開済みの README.md 本文
     */
    public String renderReadme(String language, String username, ZonedDateTime exportedAt) {
        String lang = normalize(language);
        String template = loadReadmeTemplate(lang);
        String localizedTime = formatLocalTime(exportedAt, lang);
        return template
                .replace("{{username}}", username == null ? "" : username)
                .replace("{{exportedAt}}", localizedTime);
    }

    /**
     * 通知メールの件名を返す。
     */
    public String renderEmailSubject(String language) {
        return switch (normalize(language)) {
            case "ja" -> "【Photlas】データエクスポート完了のお知らせ";
            case "ko" -> "[Photlas] 데이터 내보내기 완료 안내";
            case "zh" -> "[Photlas] 数据导出完成通知";
            case "th" -> "[Photlas] แจ้งเตือนการส่งออกข้อมูลเสร็จสิ้น";
            default -> "[Photlas] Data Export Completed";
        };
    }

    /**
     * 通知メール本文を返す（i18n 対応・乗っ取り検知のための IP / User-Agent 通知含む）。
     *
     * @param language   ユーザー言語コード
     * @param username   ユーザー表示名
     * @param exportedAt エクスポート完了日時
     * @param requestIp  リクエスト元 IP アドレス
     * @param userAgent  リクエスト元 User-Agent
     */
    public String renderEmailBody(
            String language,
            String username,
            ZonedDateTime exportedAt,
            String requestIp,
            String userAgent) {
        String lang = normalize(language);
        String localizedTime = formatLocalTime(exportedAt, lang);

        return switch (lang) {
            case "ja" -> """
                    %s さん

                    データのエクスポートが完了しました。

                    完了日時: %s
                    リクエスト元 IP: %s
                    リクエスト元 User-Agent: %s

                    身に覚えのない場合は、第三者によるアカウント乗っ取りの可能性があります。
                    速やかにパスワードを変更し、support@photlas.jp までご連絡ください。

                    Photlas
                    """.formatted(username, localizedTime, requestIp, userAgent);
            case "ko" -> """
                    %s 님

                    데이터 내보내기가 완료되었습니다.

                    완료 일시: %s
                    요청 IP: %s
                    요청 User-Agent: %s

                    본인이 요청하지 않았다면 제3자에 의한 계정 탈취 가능성이 있습니다.
                    즉시 비밀번호를 변경하고 support@photlas.jp 로 연락해 주세요.

                    Photlas
                    """.formatted(username, localizedTime, requestIp, userAgent);
            case "zh" -> """
                    %s 您好

                    数据导出已完成。

                    完成时间: %s
                    请求 IP: %s
                    请求 User-Agent: %s

                    如非本人操作，账号可能已被第三方盗用。
                    请立即修改密码并联系 support@photlas.jp。

                    Photlas
                    """.formatted(username, localizedTime, requestIp, userAgent);
            case "th" -> """
                    เรียน คุณ %s

                    การส่งออกข้อมูลเสร็จสิ้นแล้ว

                    เวลาที่เสร็จสิ้น: %s
                    IP ของผู้ร้องขอ: %s
                    User-Agent ของผู้ร้องขอ: %s

                    หากคุณไม่ใช่ผู้ร้องขอ บัญชีของคุณอาจถูกบุคคลที่สามแฮ็ก
                    โปรดเปลี่ยนรหัสผ่านทันทีและติดต่อ support@photlas.jp

                    Photlas
                    """.formatted(username, localizedTime, requestIp, userAgent);
            default -> """
                    Hi %s,

                    Your data export has completed.

                    Completed at: %s
                    Request IP: %s
                    Request User-Agent: %s

                    If you did not request this export, your account may have been compromised
                    by a third party. Please change your password immediately and contact
                    support@photlas.jp.

                    Photlas
                    """.formatted(username, localizedTime, requestIp, userAgent);
        };
    }

    /**
     * UTC 基準の {@link ZonedDateTime} をユーザー言語のタイムゾーンに変換し、
     * 末尾にタイムゾーンラベル（JST / KST / CST / ICT / UTC）を付けた文字列で返す。
     */
    private String formatLocalTime(ZonedDateTime utcDateTime, String language) {
        ZonedDateTime localized = utcDateTime.withZoneSameInstant(TimeZoneResolver.resolveZone(language));
        DateTimeFormatter formatter = pickFormatter(language);
        return localized.format(formatter) + " " + TimeZoneResolver.resolveLabel(language);
    }

    private DateTimeFormatter pickFormatter(String language) {
        return switch (language) {
            case "ja" -> DateTimeFormatter.ofPattern("yyyy年M月d日 HH:mm", Locale.JAPANESE);
            default -> DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm", Locale.ENGLISH);
        };
    }

    private String loadReadmeTemplate(String language) {
        try {
            ClassPathResource resource = new ClassPathResource(
                    "templates/data-export/readme/readme_" + language + ".md");
            return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(
                    "README テンプレートの読み込みに失敗しました: language=" + language, e);
        }
    }

    private String normalize(String language) {
        if (language == null) return FALLBACK_LANGUAGE;
        String lower = language.toLowerCase();
        return SUPPORTED_LANGUAGES.contains(lower) ? lower : FALLBACK_LANGUAGE;
    }
}
