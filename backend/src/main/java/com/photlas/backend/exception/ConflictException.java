package com.photlas.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.Objects;

/**
 * Issue#19: 競合エラー（409 Conflict）を表す例外
 *
 * <p>Issue#93: 409 は意味の違う複数の場面で使われるため、エラーコード（{@link ErrorCodes}）を必ず持たせる。
 */
@ResponseStatus(HttpStatus.CONFLICT)
public class ConflictException extends RuntimeException implements CodedException {

    private final String code;

    public ConflictException(String code, String message) {
        super(message);
        this.code = Objects.requireNonNull(code, "code");
    }

    public ConflictException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = Objects.requireNonNull(code, "code");
    }

    @Override
    public String getCode() {
        return code;
    }
}
