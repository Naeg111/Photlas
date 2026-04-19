package com.photlas.backend.util;

/**
 * Issue#81 Phase 3 - 仮ユーザー名生成器（Red 段階のスケルトン）。
 *
 * OAuth 初回ログイン時に `user_` + 7 文字の英数字ランダム列で 12 文字の仮ユーザー名を生成する。
 * Green 段階で実装する。
 */
public final class TemporaryUsernameGenerator {

    private TemporaryUsernameGenerator() {}

    public static String generate() {
        throw new UnsupportedOperationException("Red 段階: 未実装");
    }
}
