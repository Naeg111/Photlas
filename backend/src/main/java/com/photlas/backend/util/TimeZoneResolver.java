package com.photlas.backend.util;

import java.time.ZoneId;
import java.util.Map;

/**
 * Issue#108 §4.20: ユーザー言語からタイムゾーンを推定するユーティリティ。
 *
 * <p>JSON データ内の日時は機械可読性のため UTC に統一するが（§4.13）、
 * 通知メール本文や README.md など人間が読む箇所は、ユーザーの登録言語から
 * 推定したタイムゾーンで表記する。</p>
 *
 * <p>マッピング:
 * <table>
 *   <tr><th>言語コード</th><th>ZoneId</th><th>表示ラベル</th></tr>
 *   <tr><td>ja</td><td>Asia/Tokyo</td><td>JST</td></tr>
 *   <tr><td>ko</td><td>Asia/Seoul</td><td>KST</td></tr>
 *   <tr><td>zh</td><td>Asia/Shanghai</td><td>CST</td></tr>
 *   <tr><td>th</td><td>Asia/Bangkok</td><td>ICT</td></tr>
 *   <tr><td>en / その他 / null</td><td>UTC</td><td>UTC</td></tr>
 * </table>
 */
public final class TimeZoneResolver {

    private static final ZoneId UTC = ZoneId.of("UTC");

    /** 言語コード → ZoneId マッピング。未登録言語は UTC へフォールバック。 */
    private static final Map<String, ZoneId> LANGUAGE_TO_ZONE = Map.of(
            "ja", ZoneId.of("Asia/Tokyo"),
            "ko", ZoneId.of("Asia/Seoul"),
            "zh", ZoneId.of("Asia/Shanghai"),
            "th", ZoneId.of("Asia/Bangkok"),
            "en", UTC
    );

    /** 言語コード → 表示ラベル（メール本文・README.md 用）。 */
    private static final Map<String, String> LANGUAGE_TO_LABEL = Map.of(
            "ja", "JST",
            "ko", "KST",
            "zh", "CST",
            "th", "ICT",
            "en", "UTC"
    );

    private TimeZoneResolver() {}

    /**
     * 言語コードに対応する {@link ZoneId} を返す。
     * 未対応の言語コード・null・空文字はすべて UTC へフォールバックする。
     *
     * @param language 言語コード（"ja" / "ko" / "zh" / "th" / "en" 等）。大文字小文字は区別しない
     * @return 対応する {@link ZoneId}、フォールバック時は UTC
     */
    public static ZoneId resolveZone(String language) {
        String key = normalize(language);
        return key == null ? UTC : LANGUAGE_TO_ZONE.getOrDefault(key, UTC);
    }

    /**
     * 言語コードに対応する表示ラベル（"JST" / "KST" / "CST" / "ICT" / "UTC"）を返す。
     * 未対応の言語コード・null・空文字はすべて "UTC" へフォールバックする。
     *
     * @param language 言語コード
     * @return 対応する表示ラベル、フォールバック時は "UTC"
     */
    public static String resolveLabel(String language) {
        String key = normalize(language);
        return key == null ? "UTC" : LANGUAGE_TO_LABEL.getOrDefault(key, "UTC");
    }

    private static String normalize(String language) {
        return language == null ? null : language.toLowerCase();
    }
}
