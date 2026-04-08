package com.photlas.backend.util;

/**
 * 言語判定ユーティリティ
 * Accept-Languageヘッダーからユーザーの言語設定を判定する。
 */
public final class LanguageUtils {

    public static final String JAPANESE = "ja";
    public static final String ENGLISH = "en";

    private LanguageUtils() {}

    /**
     * Accept-Languageヘッダーから言語を判定する
     * 先頭が "ja" で始まる場合は日本語、それ以外は英語。
     * ヘッダーが存在しない場合は日本語をデフォルトとする。
     *
     * @param acceptLanguage Accept-Languageヘッダーの値
     * @return "ja" または "en"
     */
    public static String resolve(String acceptLanguage) {
        if (acceptLanguage == null || acceptLanguage.isBlank()) {
            return JAPANESE;
        }
        return acceptLanguage.trim().startsWith("ja") ? JAPANESE : ENGLISH;
    }
}
