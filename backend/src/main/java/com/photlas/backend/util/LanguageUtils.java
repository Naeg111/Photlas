package com.photlas.backend.util;

import java.util.List;

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

    private LanguageUtils() {}

    /**
     * Accept-Languageヘッダーから言語を判定する
     * サポート言語: ja, en, ko, zh-CN, zh-TW
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
        String lang = acceptLanguage.trim();
        if (lang.startsWith("ja")) {
            return JAPANESE;
        }
        if (lang.startsWith("ko")) {
            return KOREAN;
        }
        if (lang.startsWith("zh-TW") || lang.startsWith("zh-Hant")) {
            return CHINESE_TRADITIONAL;
        }
        if (lang.startsWith("zh")) {
            return CHINESE_SIMPLIFIED;
        }
        if (lang.startsWith("en")) {
            return ENGLISH;
        }
        return ENGLISH;
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
