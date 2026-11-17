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
}
