package com.photlas.backend.exception;

/**
 * Issue#108 §4.5: 同一ユーザーで既にエクスポートが進行中の場合に投げる例外。
 * Controller 側で 409 Conflict にマップする。
 */
public class ExportInProgressException extends RuntimeException {
    public ExportInProgressException(String message) {
        super(message);
    }
}
