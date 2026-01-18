package com.photlas.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Issue#30: お気に入りが見つからない場合の例外（404 Not Found）
 */
@ResponseStatus(HttpStatus.NOT_FOUND)
public class FavoriteNotFoundException extends RuntimeException {

    public FavoriteNotFoundException(String message) {
        super(message);
    }

    public FavoriteNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}
