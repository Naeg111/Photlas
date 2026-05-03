package com.photlas.backend.exception;

import java.time.Duration;

/**
 * Issue#108 §4.5: 168 時間（1 週間）の頻度制限に引っかかった場合に投げる例外。
 * Controller 側で 429 Too Many Requests + Retry-After ヘッダーにマップする。
 */
public class ExportRateLimitException extends RuntimeException {

    private final Duration retryAfter;

    public ExportRateLimitException(String message, Duration retryAfter) {
        super(message);
        this.retryAfter = retryAfter;
    }

    public Duration getRetryAfter() {
        return retryAfter;
    }
}
