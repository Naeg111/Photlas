package com.photlas.backend.validation;

/**
 * Issue#81 Phase 2 - LanguageValidator（Red 段階のスケルトン）
 *
 * Round 7 決定: `lang` パラメータのホワイトリスト検証を集約する。
 * Green 段階で LanguageUtils.SUPPORTED_LANGUAGES との完全一致判定 / デフォルト "ja" フォールバックを実装する。
 */
public final class LanguageValidator {

    private LanguageValidator() {}

    public static boolean isValid(String language) {
        throw new UnsupportedOperationException("Red 段階: 未実装");
    }

    public static String sanitize(String language) {
        throw new UnsupportedOperationException("Red 段階: 未実装");
    }
}
