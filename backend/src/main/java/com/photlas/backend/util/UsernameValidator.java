package com.photlas.backend.util;

import com.photlas.backend.exception.InvalidUsernameException;

/**
 * ユーザー名バリデーター。
 * Issue#98: ユーザー名バリデーション強化。
 *
 * <p>Red 段階のスケルトン。Green 段階で優先順位付きの検証ロジックを実装する。
 *
 * <p>優先順位（Issue#98 4.4 参照）:
 * <ol>
 *   <li>USERNAME_REQUIRED</li>
 *   <li>USERNAME_LENGTH_INVALID</li>
 *   <li>USERNAME_INVALID_CHARACTER_SYMBOL</li>
 *   <li>USERNAME_INVALID_CHARACTER_EMOJI</li>
 *   <li>USERNAME_INVALID_CHARACTER_FULLWIDTH</li>
 *   <li>USERNAME_INVALID_CHARACTER_HALFWIDTH_KATAKANA</li>
 *   <li>USERNAME_INVALID_CHARACTER_ZERO_WIDTH</li>
 *   <li>USERNAME_INVALID_CHARACTER_OTHER</li>
 *   <li>USERNAME_INVALID_FIRST_CHARACTER</li>
 *   <li>USERNAME_RESERVED</li>
 * </ol>
 *
 * <p>本クラスはステートレスなため static メソッドで提供する（{@link UsernameReservedWords} と同じパターン）。
 */
public final class UsernameValidator {

    private UsernameValidator() {
        // ユーティリティクラスのためインスタンス化を禁止
    }

    /**
     * ユーザー名を検証する。違反があれば {@link InvalidUsernameException} を投げる。
     *
     * <p>Red 段階のスケルトン: 常に UnsupportedOperationException を投げて
     * すべてのテストを失敗させる。Green 段階で本実装する。
     */
    public static void validate(String username) {
        throw new UnsupportedOperationException("Issue#98 Red phase: not yet implemented");
    }
}
