package com.photlas.backend.validation;

import com.photlas.backend.util.LanguageUtils;

/**
 * Issue#81 - 言語コードのホワイトリスト検証。
 *
 * Round 7 決定: OAuth 認可リクエスト時に受け取る `lang` パラメータを完全一致で検証し、
 * 未知言語はデフォルト "ja" にフォールバックする。
 * LanguageUtils.resolve() は Accept-Language 用の寛容パース（prefix マッチ）だが、
 * このバリデータはリクエストパラメータ用の厳格版として分離する。
 */
public final class LanguageValidator {

    /** 未知言語や null を受け取った際のフォールバック先 */
    public static final String DEFAULT_LANGUAGE = LanguageUtils.JAPANESE;

    private LanguageValidator() {}

    /**
     * 言語コードがサポート対象かどうかを完全一致で判定する。
     *
     * @param language 検証する言語コード
     * @return SUPPORTED_LANGUAGES と完全一致する場合 true
     */
    public static boolean isValid(String language) {
        return language != null && LanguageUtils.SUPPORTED_LANGUAGES.contains(language);
    }

    /**
     * 言語コードをサニタイズする。サポート言語ならそのまま返し、
     * それ以外（null/空文字/未知言語）はデフォルト "ja" を返す。
     *
     * @param language 検証する言語コード
     * @return サポート言語コードまたは "ja"
     */
    public static String sanitize(String language) {
        return isValid(language) ? language : DEFAULT_LANGUAGE;
    }
}
