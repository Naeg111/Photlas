package com.photlas.backend.util;

import java.util.List;
import java.util.Locale;

/**
 * 言語判定ユーティリティ
 * Accept-Languageヘッダーからユーザーの言語設定を判定する。
 */
public final class LanguageUtils {

    public static final String JAPANESE = "ja";
    public static final String ENGLISH = "en";
    public static final String KOREAN = "ko";
    public static final String CHINESE_SIMPLIFIED = "zh-CN";
    public static final String CHINESE_TRADITIONAL = "zh-TW";

    /** サポートする言語コードの一覧 */
    public static final List<String> SUPPORTED_LANGUAGES = List.of(
            JAPANESE, ENGLISH, KOREAN, CHINESE_SIMPLIFIED, CHINESE_TRADITIONAL);

    /** 繁体字を使う地域（台湾・香港・マカオ） */
    private static final List<String> TRADITIONAL_CHINESE_REGIONS = List.of("tw", "hk", "mo");

    private LanguageUtils() {}

    /**
     * Accept-Languageヘッダーから言語を判定する
     * サポート言語: ja, en, ko, zh-CN, zh-TW
     * 先頭（最も優先度の高い）言語タグだけを見る。
     * 中国語は、繁体（zh-Hant）か台湾・香港・マカオなら zh-TW、それ以外は zh-CN とする。
     * フロントエンドの resolveBrowserLanguage と同じ判定。
     * ヘッダーが存在しない場合は日本語をデフォルトとする。
     * 未対応言語の場合は英語にフォールバックする。
     *
     * @param acceptLanguage Accept-Languageヘッダーの値
     * @return サポート言語コード
     */
    public static String resolve(String acceptLanguage) {
        if (acceptLanguage == null || acceptLanguage.isBlank()) {
            return JAPANESE;
        }
        // 例: "zh-HK,zh;q=0.9,en;q=0.8" → "zh-HK"
        // limit=-1: "," や "-" だけの値でも空の配列にならないようにする
        String firstTag = acceptLanguage.split(",", -1)[0].split(";", -1)[0].trim();
        List<String> subtags = List.of(firstTag.toLowerCase(Locale.ROOT).split("[-_]", -1));
        return switch (subtags.get(0)) {
            case "ja" -> JAPANESE;
            case "ko" -> KOREAN;
            case "zh" -> isTraditionalChinese(subtags.subList(1, subtags.size()))
                    ? CHINESE_TRADITIONAL : CHINESE_SIMPLIFIED;
            default -> ENGLISH;
        };
    }

    private static boolean isTraditionalChinese(List<String> subtags) {
        // 文字の指定（Hant / Hans）があれば地域より優先する
        if (subtags.contains("hant")) {
            return true;
        }
        if (subtags.contains("hans")) {
            return false;
        }
        return subtags.stream().anyMatch(TRADITIONAL_CHINESE_REGIONS::contains);
    }

    /**
     * 言語コードがサポート対象かどうかを判定する
     *
     * @param language 言語コード
     * @return サポート対象の場合true
     */
    public static boolean isSupported(String language) {
        return language != null && SUPPORTED_LANGUAGES.contains(language);
    }
}
