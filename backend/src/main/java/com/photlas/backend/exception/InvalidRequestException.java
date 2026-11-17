package com.photlas.backend.exception;

/**
 * Issue#93: エラーコード付きの 400 Bad Request 例外。
 *
 * <p>既存の呼び出し元・テストが {@link IllegalArgumentException} として扱えるよう、
 * そのサブクラスにしている。
 */
public class InvalidRequestException extends IllegalArgumentException implements CodedException {

    private final String code;

    public InvalidRequestException(String code, String message) {
        super(message);
        this.code = code;
    }

    @Override
    public String getCode() {
        return code;
    }
}
