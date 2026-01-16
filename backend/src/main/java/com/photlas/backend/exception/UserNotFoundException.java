package com.photlas.backend.exception;

/**
 * ユーザーが見つからない場合にスローされる例外
 */
public class UserNotFoundException extends RuntimeException {

    public UserNotFoundException(String message) {
        super(message);
    }
}
