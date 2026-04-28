package com.photlas.backend.util;

import com.photlas.backend.exception.InvalidUsernameException;

import java.util.regex.Pattern;

/**
 * 表示名バリデーター。
 * Issue#98: 表示名バリデーション強化。
 *
 * <p>優先順位（Issue#98 4.4 参照）:
 * <ol>
 *   <li>USERNAME_REQUIRED (空 / null / 空白のみ)</li>
 *   <li>USERNAME_LENGTH_INVALID (2〜12 文字の範囲外)</li>
 *   <li>USERNAME_INVALID_CHARACTER_SYMBOL (記号)</li>
 *   <li>USERNAME_INVALID_CHARACTER_EMOJI (絵文字)</li>
 *   <li>USERNAME_INVALID_CHARACTER_FULLWIDTH (全角英数字)</li>
 *   <li>USERNAME_INVALID_CHARACTER_HALFWIDTH_KATAKANA (半角カタカナ)</li>
 *   <li>USERNAME_INVALID_CHARACTER_ZERO_WIDTH (ゼロ幅文字)</li>
 *   <li>USERNAME_INVALID_CHARACTER_OTHER (上記以外の不正文字)</li>
 *   <li>USERNAME_INVALID_FIRST_CHARACTER (先頭が数字 / `_` / `-`)</li>
 *   <li>USERNAME_RESERVED (予約語ヒット、大文字小文字無視)</li>
 * </ol>
 *
 * <p>本クラスはステートレスなため static メソッドで提供する。
 *
 * <p><strong>ポリシー差の注意:</strong>
 * <ul>
 *   <li>予約語チェック: <strong>大文字小文字無視 + NFKC 正規化後の比較</strong>
 *       （`Admin` `ADMIN` `aDmIn` 等の大文字混在は予約語 `admin` としてヒット）</li>
 *   <li>通常の表示名同士の衝突判定: <strong>大文字小文字を区別する</strong>
 *       （`Tanaka` と `tanaka` は別ユーザーとして許容）</li>
 * </ul>
 */
public final class UsernameValidator {

    /**
     * 全文字が許可セット内にあることをチェックするパターン（先頭文字制約なし）。
     * 優先順位 8: USERNAME_INVALID_CHARACTER_OTHER 用。
     */
    private static final Pattern ALL_ALLOWED_CHARS = Pattern.compile(
            "^[a-zA-Z0-9_\\-\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF]+$"
    );

    /**
     * 先頭文字が許可セット内にあることをチェックするパターン
     * （英字 / ひらがな / 全角カタカナ / 漢字。数字・`_`・`-` は不可）。
     * 優先順位 9: USERNAME_INVALID_FIRST_CHARACTER 用。
     */
    private static final Pattern FIRST_CHAR_ALLOWED = Pattern.compile(
            "^[a-zA-Z\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF].*$",
            Pattern.DOTALL
    );

    private static final int MIN_LENGTH = 2;
    private static final int MAX_LENGTH = 12;

    private UsernameValidator() {
        // ユーティリティクラスのためインスタンス化を禁止
    }

    /**
     * 表示名を検証する。違反があれば {@link InvalidUsernameException} を投げる。
     *
     * <p>優先順位順に検査し、最初に該当したエラーキーで例外を投げる。
     */
    public static void validate(String username) {
        // 1. 必須チェック
        if (username == null || username.isBlank()) {
            throw new InvalidUsernameException("USERNAME_REQUIRED");
        }

        // 2. 長さチェック
        if (username.length() < MIN_LENGTH || username.length() > MAX_LENGTH) {
            throw new InvalidUsernameException("USERNAME_LENGTH_INVALID");
        }

        // 3〜7. 文字種ごとの判定（優先順位順に検査）
        if (containsSymbol(username)) {
            throw new InvalidUsernameException("USERNAME_INVALID_CHARACTER_SYMBOL");
        }
        if (containsEmoji(username)) {
            throw new InvalidUsernameException("USERNAME_INVALID_CHARACTER_EMOJI");
        }
        if (containsFullwidthAlphanumeric(username)) {
            throw new InvalidUsernameException("USERNAME_INVALID_CHARACTER_FULLWIDTH");
        }
        if (containsHalfwidthKatakana(username)) {
            throw new InvalidUsernameException("USERNAME_INVALID_CHARACTER_HALFWIDTH_KATAKANA");
        }
        if (containsZeroWidthCharacter(username)) {
            throw new InvalidUsernameException("USERNAME_INVALID_CHARACTER_ZERO_WIDTH");
        }

        // 8. 許可文字セット内かチェック（先頭制約なしの ALL_ALLOWED_CHARS パターン）
        //    ここで弾かれるのは CJK 拡張漢字・キリル文字・ギリシャ文字 等
        if (!ALL_ALLOWED_CHARS.matcher(username).matches()) {
            throw new InvalidUsernameException("USERNAME_INVALID_CHARACTER_OTHER");
        }

        // 9. 先頭文字チェック（FIRST_CHAR_ALLOWED パターン）
        //    数字 / `_` / `-` で始まる場合をここで具体的エラーとして検出
        if (!FIRST_CHAR_ALLOWED.matcher(username).matches()) {
            throw new InvalidUsernameException("USERNAME_INVALID_FIRST_CHARACTER");
        }

        // 10. 予約語チェック（NFKC 正規化 + 大文字小文字無視）
        if (UsernameReservedWords.isReserved(username)) {
            throw new InvalidUsernameException("USERNAME_RESERVED");
        }
    }

    /**
     * 記号判定: ASCII printable (0x21-0x7E) のうち、英数字・`_`・`-` 以外。
     * 例: ! " # $ % &amp; ' ( ) * + , . / : ; &lt; = &gt; ? @ [ \ ] ^ ` { | } ~
     * （全角の記号 `！＂＃` 等は priority 8 の OTHER 側で検出する）
     */
    private static boolean containsSymbol(String s) {
        return s.chars().anyMatch(c -> {
            if (c >= '0' && c <= '9') return false;
            if (c >= 'A' && c <= 'Z') return false;
            if (c >= 'a' && c <= 'z') return false;
            if (c == '_' || c == '-') return false;
            return c >= 0x21 && c <= 0x7E;
        });
    }

    /**
     * 絵文字判定: 主要な絵文字ブロックの code point を含むか。
     * BMP 内の絵文字（☃ ⚡ ✂ 等）と、補助多言語面 (SMP) の絵文字（😀 🎉 等）を網羅。
     */
    private static boolean containsEmoji(String s) {
        return s.codePoints().anyMatch(cp ->
                (cp >= 0x2600 && cp <= 0x26FF)      // Misc Symbols (☃ ⚡ など)
                        || (cp >= 0x2700 && cp <= 0x27BF)   // Dingbats (✂ ✈ ✊ など)
                        || (cp >= 0x1F1E6 && cp <= 0x1F1FF) // Regional Indicator (国旗)
                        || (cp >= 0x1F300 && cp <= 0x1F5FF) // Misc Symbols and Pictographs
                        || (cp >= 0x1F600 && cp <= 0x1F64F) // Emoticons (😀 など)
                        || (cp >= 0x1F680 && cp <= 0x1F6FF) // Transport and Map
                        || (cp >= 0x1F900 && cp <= 0x1F9FF) // Supplemental Symbols and Pictographs
                        || (cp >= 0x1FA70 && cp <= 0x1FAFF) // Symbols and Pictographs Extended-A
        );
    }

    /**
     * 全角英数字判定（ホモグラフ攻撃対策）。`Ａ-Ｚ`, `ａ-ｚ`, `０-９` のみ。
     * 全角の記号（`！＂＃` 等）はこの判定には含めず、priority 8 の OTHER 側で検出する。
     */
    private static boolean containsFullwidthAlphanumeric(String s) {
        return s.chars().anyMatch(c ->
                (c >= 0xFF10 && c <= 0xFF19)  // ０-９
                        || (c >= 0xFF21 && c <= 0xFF3A)  // Ａ-Ｚ
                        || (c >= 0xFF41 && c <= 0xFF5A)  // ａ-ｚ
        );
    }

    /**
     * 半角カタカナ判定。Halfwidth Katakana ブロック (U+FF65-U+FF9F)。
     */
    private static boolean containsHalfwidthKatakana(String s) {
        return s.chars().anyMatch(c -> c >= 0xFF65 && c <= 0xFF9F);
    }

    /**
     * ゼロ幅文字判定。代表的な不可視文字を網羅。
     * U+200B (Zero Width Space) / U+200C (ZWNJ) / U+200D (ZWJ) /
     * U+2060 (Word Joiner) / U+FEFF (BOM) / U+180E (Mongolian Vowel Separator)
     */
    private static boolean containsZeroWidthCharacter(String s) {
        return s.chars().anyMatch(c ->
                c == 0x200B || c == 0x200C || c == 0x200D
                        || c == 0x2060 || c == 0xFEFF || c == 0x180E
        );
    }
}
