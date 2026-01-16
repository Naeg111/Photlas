package com.photlas.backend.exception;

/**
 * スポットが見つからない場合にスローされる例外
 */
public class SpotNotFoundException extends RuntimeException {

    public SpotNotFoundException(String message) {
        super(message);
    }

    public SpotNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}
