package com.photlas.backend.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * AsyncConfig のテスト
 * Issue#95: @Async 実行時の MDC（トレース ID）を非同期スレッドに伝搬する TaskDecorator の検証
 *
 * TDD Red段階: 実装前のテストケース定義
 */
@SpringBootTest
@ActiveProfiles("test")
public class AsyncConfigTest {

    @Autowired
    private TestAsyncCaptureService captureService;

    @BeforeEach
    void setUp() {
        MDC.clear();
    }

    @AfterEach
    void tearDown() {
        MDC.clear();
    }

    @Test
    @DisplayName("Issue#95 - 呼び出し元の MDC が @Async スレッドに伝搬される")
    void testAsyncExecution_PropagatesMdcFromCallerThread() throws Exception {
        String expectedTraceId = "Root=1-5759e988-bd862e3fe1be46a994272793";
        MDC.put("traceId", expectedTraceId);

        TestAsyncCaptureService.AsyncCaptureResult result =
                captureService.captureTraceId().get(5, TimeUnit.SECONDS);

        assertEquals(expectedTraceId, result.traceId(),
                "@Async スレッドで呼び出し元の traceId が取得できるべき（TaskDecorator の伝搬）");
        // 別スレッドで動いていることを確認（photlas-async-* プレフィックス）
        assertTrue(result.threadName().startsWith("photlas-async-"),
                "@Async は専用プールスレッドで動くべき - actual threadName: " + result.threadName());
        assertNotEquals(Thread.currentThread().getName(), result.threadName(),
                "@Async は呼び出し元とは別スレッドで動くべき");
    }

    @Test
    @DisplayName("Issue#95 - 非同期処理完了後は呼び出し元スレッドの MDC が元の状態に戻る")
    void testAsyncExecution_CallerMdcUnchangedAfterCompletion() throws Exception {
        String callerTraceId = "Root=caller-thread-value";
        MDC.put("traceId", callerTraceId);

        captureService.captureTraceId().get(5, TimeUnit.SECONDS);

        // 呼び出し元スレッド(テストスレッド)の MDC は変わっていないはず
        assertEquals(callerTraceId, MDC.get("traceId"),
                "非同期処理後も呼び出し元スレッドの MDC は変わらないべき");
    }

    @Test
    @DisplayName("Issue#95 - MDC が空の状態で @Async を呼ぶと、非同期スレッドでも空になる")
    void testAsyncExecution_NullMdcPropagatesAsNull() throws Exception {
        MDC.clear();

        TestAsyncCaptureService.AsyncCaptureResult result =
                captureService.captureTraceId().get(5, TimeUnit.SECONDS);

        assertNull(result.traceId(),
                "呼び出し元の MDC が空なら非同期スレッドでも空であるべき");
    }
}
