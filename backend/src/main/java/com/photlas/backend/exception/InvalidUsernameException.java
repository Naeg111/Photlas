package com.photlas.backend.exception;

/**
 * ユーザー名バリデーション失敗時に投げる例外。
 * Issue#98: ユーザー名バリデーション強化。
 *
 * <p>エラーキー（例: {@code USERNAME_RESERVED}）をペイロードとして保持し、
 * {@code UsernameConstraintValidator} が {@code errors.USERNAME_*} 形式の
 * i18n キーに整形してメッセージとして設定する。
 */
public class InvalidUsernameException extends RuntimeException {

    private final String errorKey;

    public InvalidUsernameException(String errorKey) {
        super(errorKey);
        this.errorKey = errorKey;
    }

    public String getErrorKey() {
        return errorKey;
    }
}
