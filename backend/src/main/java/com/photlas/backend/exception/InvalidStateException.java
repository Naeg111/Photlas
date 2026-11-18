package com.photlas.backend.exception;

import java.util.Objects;

/**
 * Spec#93: エラーコード付きの「今の状態ではできない操作」を表す例外。
 *
 * <p>既存の呼び出し元・テストが {@link IllegalStateException} として扱えるよう、
 * そのサブクラスにしている。
 */
public class InvalidStateException extends IllegalStateException implements CodedException {

    private final String code;

    public InvalidStateException(String code, String message) {
        super(message);
        this.code = Objects.requireNonNull(code, "code");
    }

    @Override
    public String getCode() {
        return code;
    }
}
