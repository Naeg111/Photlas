package com.photlas.backend.util;

import java.util.Set;

/**
 * ユーザー名の予約語リスト。
 * Issue#98: ユーザー名バリデーション強化。
 *
 * <p>Red 段階のスケルトン。Green 段階で予約語リストと {@code isReserved()} を実装する。
 */
public final class UsernameReservedWords {

    public static final Set<String> RESERVED = Set.of();

    private UsernameReservedWords() {
        // ユーティリティクラスのためインスタンス化を禁止
    }

    /**
     * 予約語かどうかを判定する。
     *
     * <p>Red 段階のスケルトン。Green 段階で大文字小文字無視 + NFKC 正規化後の比較を実装する。
     */
    public static boolean isReserved(String username) {
        throw new UnsupportedOperationException("Issue#98 Red phase: not yet implemented");
    }
}
