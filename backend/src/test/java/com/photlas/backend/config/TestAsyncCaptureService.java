package com.photlas.backend.config;

import org.slf4j.MDC;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.concurrent.CompletableFuture;

/**
 * AsyncConfigTest 専用のテスト用 @Component。
 * Issue#95: @Async メソッド内で MDC の内容を取得して返す最小実装で、
 * AsyncConfig の TaskDecorator が MDC をスレッド間で伝搬するか検証する。
 */
@Component
public class TestAsyncCaptureService {

    /**
     * 非同期スレッド内で MDC の traceId キーを取得して返す。
     * TaskDecorator が正しく動作していれば呼び出しスレッドの値がそのまま取得できる。
     * また呼び出しスレッドの名前も返して、別スレッドで動いていることを確認可能にする。
     */
    @Async
    public CompletableFuture<AsyncCaptureResult> captureTraceId() {
        String traceId = MDC.get("traceId");
        String threadName = Thread.currentThread().getName();
        return CompletableFuture.completedFuture(new AsyncCaptureResult(traceId, threadName));
    }

    public record AsyncCaptureResult(String traceId, String threadName) {
    }
}
