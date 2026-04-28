package com.photlas.backend.util;

import java.security.SecureRandom;

/**
 * Issue#81 Phase 3 - 仮表示名生成器。
 *
 * OAuth 初回ログイン時、表示名確定画面までの中継値として仮名を生成する。
 * フォーマット: `user_` + 7 文字の英数字ランダム列（合計 12 文字、User.username の最大長と一致）。
 *
 * 文字セット: 小文字 + 数字（36 種）→ 36^7 ≒ 780 億通りで現実的な衝突は無い。
 * ただし重複が発生した場合は呼び出し側で UNIQUE(username) 違反を捕捉して再生成する想定。
 */
public final class TemporaryUsernameGenerator {

    private static final String PREFIX = "user_";
    private static final int SUFFIX_LENGTH = 7;
    private static final String ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private TemporaryUsernameGenerator() {}

    /**
     * 仮表示名を 1 つ生成する。
     *
     * @return `user_` + 7 文字の英数字（計 12 文字）
     */
    public static String generate() {
        StringBuilder sb = new StringBuilder(PREFIX.length() + SUFFIX_LENGTH);
        sb.append(PREFIX);
        for (int i = 0; i < SUFFIX_LENGTH; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
