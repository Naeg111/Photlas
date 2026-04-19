package com.photlas.backend.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#81 Phase 3 - TemporaryUsernameGenerator のテスト
 *
 * OAuth 初回ログイン時に仮ユーザー名（ユーザー名確定画面までの中継値）を生成する。
 * User.username は 2-12 文字の制約があるため、仮名もこれに従う。
 *
 * フォーマット: `user_` + 7 文字の英数字ランダム列（合計 12 文字）
 */
class TemporaryUsernameGeneratorTest {

    private static final Pattern EXPECTED = Pattern.compile("^user_[a-z0-9]{7}$");

    @Test
    @DisplayName("Issue#81 - 生成された仮ユーザー名が 12 文字である（User.username の最大長）")
    void generatedUsernameIs12Chars() {
        String username = TemporaryUsernameGenerator.generate();
        assertThat(username).hasSize(12);
    }

    @Test
    @DisplayName("Issue#81 - 生成された仮ユーザー名が `user_` で始まる")
    void generatedUsernameStartsWithUserPrefix() {
        String username = TemporaryUsernameGenerator.generate();
        assertThat(username).startsWith("user_");
    }

    @Test
    @DisplayName("Issue#81 - 生成された仮ユーザー名がフォーマット user_[a-z0-9]{7} に一致する")
    void generatedUsernameMatchesPattern() {
        String username = TemporaryUsernameGenerator.generate();
        assertThat(EXPECTED.matcher(username).matches())
                .as("username=%s", username)
                .isTrue();
    }

    @Test
    @DisplayName("Issue#81 - 1000 回生成しても重複が発生しない（36^7 の広さ ≒ 780 億）")
    void noDuplicateIn1000Generations() {
        Set<String> generated = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            generated.add(TemporaryUsernameGenerator.generate());
        }
        assertThat(generated).hasSize(1000);
    }
}
