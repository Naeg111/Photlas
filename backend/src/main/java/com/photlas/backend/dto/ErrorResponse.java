package com.photlas.backend.dto;

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

    /**
     * code の無いエラーレスポンス。
     *
     * <p>Issue#93: 画面に出ない機械どうしの API（LQIP・審査のコールバック、テスト用 API）だけで使う。
     * 利用者に届くエラーは、フロントが code から表示言語の文言を出すため、
     * {@link #ErrorResponse(String, String)} で {@code ErrorCodes} のコードを付けること。
     * 誤って使わないよう、コンストラクターではなく名前で用途がわかる静的ファクトリにしている。
     */
    public static ErrorResponse withoutCode(String message) {
        ErrorResponse errorResponse = new ErrorResponse();
        errorResponse.setMessage(message);
        return errorResponse;
    }

    public ErrorResponse(String code, String message) {
        this.code = code;
        this.message = message;
        this.timestamp = LocalDateTime.now();
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