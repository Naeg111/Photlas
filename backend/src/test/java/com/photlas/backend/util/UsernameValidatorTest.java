package com.photlas.backend.util;

import com.photlas.backend.exception.InvalidUsernameException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * UsernameValidator のテスト。
 * Issue#98 4.9 想定テストケース T1〜T50 をカバーする。
 *
 * <p>優先順位: 1=REQUIRED, 2=LENGTH_INVALID, 3=SYMBOL, 4=EMOJI,
 * 5=FULLWIDTH, 6=HALFWIDTH_KATAKANA, 7=ZERO_WIDTH,
 * 8=OTHER, 9=FIRST_CHARACTER, 10=RESERVED
 */
class UsernameValidatorTest {

    /**
     * 期待エラーキーで例外が投げられることを検証するヘルパー。
     */
    private void assertInvalidUsername(String username, String expectedErrorKey) {
        InvalidUsernameException ex = assertThrows(
                InvalidUsernameException.class,
                () -> UsernameValidator.validate(username),
                "expected InvalidUsernameException(" + expectedErrorKey + ") for: " + username
        );
        assertEquals(expectedErrorKey, ex.getErrorKey(),
                "errorKey mismatch for input: " + username);
    }

    @Nested
    @DisplayName("4.9.1 必須・長さ（優先順位 1〜2）")
    class RequiredAndLength {

        @Test
        @DisplayName("Issue#98 T1 - null は USERNAME_REQUIRED")
        void t1_null_required() {
            assertInvalidUsername(null, "USERNAME_REQUIRED");
        }

        @Test
        @DisplayName("Issue#98 T2 - 空文字は USERNAME_REQUIRED")
        void t2_empty_required() {
            assertInvalidUsername("", "USERNAME_REQUIRED");
        }

        @Test
        @DisplayName("Issue#98 T3 - 半角スペースのみは USERNAME_REQUIRED")
        void t3_halfwidth_spaces_required() {
            assertInvalidUsername("   ", "USERNAME_REQUIRED");
        }

        @Test
        @DisplayName("Issue#98 T4 - 全角スペースのみは USERNAME_REQUIRED (isBlank Unicode 対応)")
        void t4_fullwidth_spaces_required() {
            assertInvalidUsername("　　", "USERNAME_REQUIRED");
        }

        @Test
        @DisplayName("Issue#98 T5 - 1文字は USERNAME_LENGTH_INVALID")
        void t5_one_char_too_short() {
            assertInvalidUsername("a", "USERNAME_LENGTH_INVALID");
        }

        @Test
        @DisplayName("Issue#98 T6 - 13文字は USERNAME_LENGTH_INVALID")
        void t6_thirteen_chars_too_long() {
            assertInvalidUsername("abcdefghijklm", "USERNAME_LENGTH_INVALID");
        }

        @Test
        @DisplayName("Issue#98 T7 - 2文字（境界値）は通過する")
        void t7_two_chars_boundary_passes() {
            assertDoesNotThrow(() -> UsernameValidator.validate("ab"));
        }

        @Test
        @DisplayName("Issue#98 T8 - 12文字（境界値）は通過する")
        void t8_twelve_chars_boundary_passes() {
            assertDoesNotThrow(() -> UsernameValidator.validate("abcdefghijkl"));
        }
    }

    @Nested
    @DisplayName("4.9.2 文字種違反（優先順位 3〜8）")
    class CharacterTypeViolations {

        @Test
        @DisplayName("Issue#98 T9 - @ を含むと USERNAME_INVALID_CHARACTER_SYMBOL")
        void t9_at_sign_symbol() {
            assertInvalidUsername("abc@def", "USERNAME_INVALID_CHARACTER_SYMBOL");
        }

        @Test
        @DisplayName("Issue#98 T10 - ピリオドを含むと USERNAME_INVALID_CHARACTER_SYMBOL")
        void t10_period_symbol() {
            assertInvalidUsername("abc.def", "USERNAME_INVALID_CHARACTER_SYMBOL");
        }

        @Test
        @DisplayName("Issue#98 T11 - SMP 絵文字 😀 は USERNAME_INVALID_CHARACTER_EMOJI")
        void t11_smp_emoji() {
            assertInvalidUsername("abc😀", "USERNAME_INVALID_CHARACTER_EMOJI");
        }

        @Test
        @DisplayName("Issue#98 T12 - BMP 絵文字 ☃ は USERNAME_INVALID_CHARACTER_EMOJI")
        void t12_bmp_emoji() {
            assertInvalidUsername("abc☃", "USERNAME_INVALID_CHARACTER_EMOJI");
        }

        @Test
        @DisplayName("Issue#98 T13 - 国旗絵文字 🇯🇵 は USERNAME_INVALID_CHARACTER_EMOJI")
        void t13_flag_emoji() {
            // 🇯🇵 = U+1F1EF U+1F1F5
            assertInvalidUsername("abc🇯🇵", "USERNAME_INVALID_CHARACTER_EMOJI");
        }

        @Test
        @DisplayName("Issue#98 T14 - 全角 A は USERNAME_INVALID_CHARACTER_FULLWIDTH")
        void t14_fullwidth_alpha() {
            assertInvalidUsername("Ａbc", "USERNAME_INVALID_CHARACTER_FULLWIDTH");
        }

        @Test
        @DisplayName("Issue#98 T15 - 全角数字 １２ は USERNAME_INVALID_CHARACTER_FULLWIDTH")
        void t15_fullwidth_digits() {
            assertInvalidUsername("abc１２", "USERNAME_INVALID_CHARACTER_FULLWIDTH");
        }

        @Test
        @DisplayName("Issue#98 T16 - 半角カタカナ ｱｲｳ は USERNAME_INVALID_CHARACTER_HALFWIDTH_KATAKANA")
        void t16_halfwidth_katakana() {
            assertInvalidUsername("ｱｲｳ", "USERNAME_INVALID_CHARACTER_HALFWIDTH_KATAKANA");
        }

        @Test
        @DisplayName("Issue#98 T17 - ゼロ幅スペース U+200B は USERNAME_INVALID_CHARACTER_ZERO_WIDTH")
        void t17_zero_width_space() {
            assertInvalidUsername("abc​def", "USERNAME_INVALID_CHARACTER_ZERO_WIDTH");
        }

        @Test
        @DisplayName("Issue#98 T18 - BOM U+FEFF は USERNAME_INVALID_CHARACTER_ZERO_WIDTH")
        void t18_bom() {
            assertInvalidUsername("abc﻿def", "USERNAME_INVALID_CHARACTER_ZERO_WIDTH");
        }

        @Test
        @DisplayName("Issue#98 T19 - Word Joiner U+2060 は USERNAME_INVALID_CHARACTER_ZERO_WIDTH")
        void t19_word_joiner() {
            assertInvalidUsername("abc⁠def", "USERNAME_INVALID_CHARACTER_ZERO_WIDTH");
        }

        @Test
        @DisplayName("Issue#98 T20 - キリル文字は USERNAME_INVALID_CHARACTER_OTHER")
        void t20_cyrillic_other() {
            assertInvalidUsername("абвгд", "USERNAME_INVALID_CHARACTER_OTHER");
        }

        @Test
        @DisplayName("Issue#98 T21 - ギリシャ文字は USERNAME_INVALID_CHARACTER_OTHER")
        void t21_greek_other() {
            assertInvalidUsername("αβγδε", "USERNAME_INVALID_CHARACTER_OTHER");
        }

        @Test
        @DisplayName("Issue#98 T22 - CJK 拡張 B 漢字 𠮟責 は USERNAME_INVALID_CHARACTER_OTHER")
        void t22_cjk_extension_other() {
            // 𠮟 = U+20B9F (surrogate pair: U+D842 U+DF9F), 責 = U+8CAC
            assertInvalidUsername("𠮟責", "USERNAME_INVALID_CHARACTER_OTHER");
        }
    }

    @Nested
    @DisplayName("4.9.3 優先順位確認（複数違反入力）")
    class PriorityVerification {

        @Test
        @DisplayName("Issue#98 T23 - 記号+絵文字+予約語 → SYMBOL が最優先")
        void t23_symbol_wins() {
            assertInvalidUsername("@😀admin", "USERNAME_INVALID_CHARACTER_SYMBOL");
        }

        @Test
        @DisplayName("Issue#98 T24 - 絵文字+全角 → EMOJI が FULLWIDTH に優先")
        void t24_emoji_wins_over_fullwidth() {
            assertInvalidUsername("😀Ａbc", "USERNAME_INVALID_CHARACTER_EMOJI");
        }

        @Test
        @DisplayName("Issue#98 T25 - 全角+半角カナ → FULLWIDTH が HALFWIDTH_KATAKANA に優先")
        void t25_fullwidth_wins_over_halfwidth_katakana() {
            assertInvalidUsername("Ａbcｱ", "USERNAME_INVALID_CHARACTER_FULLWIDTH");
        }

        @Test
        @DisplayName("Issue#98 T26 - 半角カナ+ゼロ幅 → HALFWIDTH_KATAKANA が ZERO_WIDTH に優先")
        void t26_halfwidth_katakana_wins_over_zero_width() {
            assertInvalidUsername("ｱ​", "USERNAME_INVALID_CHARACTER_HALFWIDTH_KATAKANA");
        }
    }

    @Nested
    @DisplayName("4.9.4 先頭文字（優先順位 9）")
    class FirstCharacter {

        @Test
        @DisplayName("Issue#98 T27 - 数字始まり 1tanaka は USERNAME_INVALID_FIRST_CHARACTER")
        void t27_digit_first() {
            assertInvalidUsername("1tanaka", "USERNAME_INVALID_FIRST_CHARACTER");
        }

        @Test
        @DisplayName("Issue#98 T28 - アンダースコア始まり _tanaka は USERNAME_INVALID_FIRST_CHARACTER")
        void t28_underscore_first() {
            assertInvalidUsername("_tanaka", "USERNAME_INVALID_FIRST_CHARACTER");
        }

        @Test
        @DisplayName("Issue#98 T29 - ハイフン始まり -tanaka は USERNAME_INVALID_FIRST_CHARACTER")
        void t29_hyphen_first() {
            assertInvalidUsername("-tanaka", "USERNAME_INVALID_FIRST_CHARACTER");
        }

        @Test
        @DisplayName("Issue#98 T30 - 英字始まり a1234 は通過する")
        void t30_alpha_first_passes() {
            assertDoesNotThrow(() -> UsernameValidator.validate("a1234"));
        }

        @Test
        @DisplayName("Issue#98 T31 - ひらがな始まり あ太郎 は通過する")
        void t31_hiragana_first_passes() {
            assertDoesNotThrow(() -> UsernameValidator.validate("あ太郎"));
        }

        @Test
        @DisplayName("Issue#98 T32 - 漢字始まり 太郎a は通過する")
        void t32_kanji_first_passes() {
            assertDoesNotThrow(() -> UsernameValidator.validate("太郎a"));
        }

        @Test
        @DisplayName("Issue#98 T33 - 全角カタカナ始まり カタカナ は通過する")
        void t33_fullwidth_katakana_first_passes() {
            assertDoesNotThrow(() -> UsernameValidator.validate("カタカナ"));
        }
    }

    @Nested
    @DisplayName("4.9.5 予約語（優先順位 10、大文字小文字無視）")
    class ReservedWords {

        @Test
        @DisplayName("Issue#98 T34 - admin は USERNAME_RESERVED")
        void t34_admin_lowercase() {
            assertInvalidUsername("admin", "USERNAME_RESERVED");
        }

        @Test
        @DisplayName("Issue#98 T35 - ADMIN（大文字）は USERNAME_RESERVED")
        void t35_admin_uppercase() {
            assertInvalidUsername("ADMIN", "USERNAME_RESERVED");
        }

        @Test
        @DisplayName("Issue#98 T36 - Admin（混在）は USERNAME_RESERVED")
        void t36_admin_mixedcase() {
            assertInvalidUsername("Admin", "USERNAME_RESERVED");
        }

        @Test
        @DisplayName("Issue#98 T37 - Ａdmin（部分全角）は priority 5 で確定するため FULLWIDTH")
        void t37_partial_fullwidth() {
            assertInvalidUsername("Ａdmin", "USERNAME_INVALID_CHARACTER_FULLWIDTH");
        }

        @Test
        @DisplayName("Issue#98 T38 - ＡＤＭＩＮ（全文字全角）は priority 5 で確定するため FULLWIDTH")
        void t38_all_fullwidth() {
            assertInvalidUsername("ＡＤＭＩＮ", "USERNAME_INVALID_CHARACTER_FULLWIDTH");
        }

        @Test
        @DisplayName("Issue#98 T39 - photlas は USERNAME_RESERVED")
        void t39_photlas() {
            assertInvalidUsername("photlas", "USERNAME_RESERVED");
        }

        @Test
        @DisplayName("Issue#98 T40 - home は USERNAME_RESERVED")
        void t40_home() {
            assertInvalidUsername("home", "USERNAME_RESERVED");
        }

        @Test
        @DisplayName("Issue#98 T41 - admin1 は完全一致しないため通過する")
        void t41_admin1_passes() {
            assertDoesNotThrow(() -> UsernameValidator.validate("admin1"));
        }

        @Test
        @DisplayName("Issue#98 T42 - admins は完全一致しないため通過する")
        void t42_admins_passes() {
            assertDoesNotThrow(() -> UsernameValidator.validate("admins"));
        }
    }

    @Nested
    @DisplayName("4.9.6 許可される入力（パス）")
    class AllowedInputs {

        @Test
        @DisplayName("Issue#98 T43 - tanaka は通過する")
        void t43_tanaka() {
            assertDoesNotThrow(() -> UsernameValidator.validate("tanaka"));
        }

        @Test
        @DisplayName("Issue#98 T44 - Tanaka は通過する")
        void t44_Tanaka() {
            assertDoesNotThrow(() -> UsernameValidator.validate("Tanaka"));
        }

        @Test
        @DisplayName("Issue#98 T45 - tanaka_01 は通過する")
        void t45_tanaka_underscore_01() {
            assertDoesNotThrow(() -> UsernameValidator.validate("tanaka_01"));
        }

        @Test
        @DisplayName("Issue#98 T46 - tanaka-01 は通過する")
        void t46_tanaka_hyphen_01() {
            assertDoesNotThrow(() -> UsernameValidator.validate("tanaka-01"));
        }

        @Test
        @DisplayName("Issue#98 T47 - 田中太郎 は通過する")
        void t47_kanji_full_name() {
            assertDoesNotThrow(() -> UsernameValidator.validate("田中太郎"));
        }

        @Test
        @DisplayName("Issue#98 T48 - たなか太郎 は通過する")
        void t48_hiragana_kanji() {
            assertDoesNotThrow(() -> UsernameValidator.validate("たなか太郎"));
        }

        @Test
        @DisplayName("Issue#98 T49 - カタカナ（全角）は通過する")
        void t49_fullwidth_katakana() {
            assertDoesNotThrow(() -> UsernameValidator.validate("カタカナ"));
        }

        @Test
        @DisplayName("Issue#98 T50 - user_a3f8b2c（Issue#81 仮ユーザー名形式）は通過する")
        void t50_oauth_temp_username() {
            assertDoesNotThrow(() -> UsernameValidator.validate("user_a3f8b2c"));
        }
    }
}
