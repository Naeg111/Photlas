package com.photlas.backend.exception;

public class SpotNotFoundException extends RuntimeException {

    public SpotNotFoundException(String message) {
        super(message);
    }

    public SpotNotFoundException(String message, Throwable cause) {
        super(message, cause);
    }
}
