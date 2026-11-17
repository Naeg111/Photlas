package com.photlas.backend.exception;

/**
 * Issue#93: エラーコード（{@link ErrorCodes}）を持つ例外。
 * 例外ハンドラーはこのコードをエラーレスポンスの {@code code} に入れる。
 */
public interface CodedException {

    /**
     * @return エラーコード（{@link ErrorCodes} の値）
     */
    String getCode();

    /**
     * 例外がエラーコードを持っていればそれを、持っていなければ {@code fallback} を返す。
     */
    static String codeOf(Throwable ex, String fallback) {
        if (ex instanceof CodedException coded && coded.getCode() != null) {
            return coded.getCode();
        }
        return fallback;
    }
}
