package com.photlas.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Issue#54: 自分のコンテンツを通報しようとした場合の例外（400 Bad Request）
 */
@ResponseStatus(HttpStatus.BAD_REQUEST)
public class SelfReportException extends RuntimeException {

    public SelfReportException(String message) {
        super(message);
    }
}
