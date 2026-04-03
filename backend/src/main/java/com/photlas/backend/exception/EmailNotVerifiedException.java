package com.photlas.backend.exception;

/**
 * メールアドレスが未認証の状態でログインを試みた場合の例外
 */
public class EmailNotVerifiedException extends RuntimeException {

    public EmailNotVerifiedException(String message) {
        super(message);
    }
}
