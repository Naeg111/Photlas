package com.photlas.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Issue#104: 操作が禁止されている場合の汎用 403 例外。
 *
 * <p>例：cancel-registration を同意済みユーザーが呼び出した場合等、
 * 認証は通っているが操作が許可されていないケースで使用する。
 */
@ResponseStatus(HttpStatus.FORBIDDEN)
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
