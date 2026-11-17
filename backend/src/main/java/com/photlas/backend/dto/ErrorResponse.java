package com.photlas.backend.dto;

import com.photlas.backend.exception.CodedException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * エラーレスポンスDTO
 * APIエラー発生時にクライアントに返却される情報を格納します。
 */
public class ErrorResponse {
    private String code;
    private String message;
    private List<FieldError> errors;
    private LocalDateTime timestamp;

    public ErrorResponse() {
        this.timestamp = LocalDateTime.now();
    }

    public ErrorResponse(String message) {
        this.message = message;
        this.timestamp = LocalDateTime.now();
    }

    public ErrorResponse(String code, String message) {
        this.code = code;
        this.message = message;
        this.timestamp = LocalDateTime.now();
    }

    /**
     * Issue#93: 例外からエラーレスポンスを作る。
     * 例外がエラーコードを持っていればそのコード、持っていなければ {@code fallbackCode} を使う。
     */
    public static ErrorResponse of(Throwable ex, String fallbackCode) {
        return new ErrorResponse(CodedException.codeOf(ex, fallbackCode), ex.getMessage());
    }

    // Getters and Setters
    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public List<FieldError> getErrors() {
        return errors;
    }

    public void setErrors(List<FieldError> errors) {
        this.errors = errors;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }

    /**
     * フィールドレベルのエラー情報
     * バリデーションエラーが発生したフィールドの詳細を格納します。
     */
    public static class FieldError {
        private String field;
        private Object rejectedValue;
        private String message;

        public FieldError() {}

        public FieldError(String field, Object rejectedValue, String message) {
            this.field = field;
            this.rejectedValue = rejectedValue;
            this.message = message;
        }

        // Getters and Setters
        public String getField() {
            return field;
        }

        public void setField(String field) {
            this.field = field;
        }

        public Object getRejectedValue() {
            return rejectedValue;
        }

        public void setRejectedValue(Object rejectedValue) {
            this.rejectedValue = rejectedValue;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }
    }
}