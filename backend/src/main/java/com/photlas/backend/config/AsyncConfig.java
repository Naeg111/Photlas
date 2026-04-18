package com.photlas.backend.config;

import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskDecorator;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.Map;
import java.util.concurrent.Executor;

/**
 * @Async 実行用 ThreadPoolTaskExecutor の設定
 * Issue#95: 呼び出しスレッドの MDC（traceId など）を非同期スレッドに伝搬させる
 *
 * TaskDecorator により、タスク実行前に呼び出し元スレッドの MDC をキャプチャし、
 * 実行スレッドへセット→実行後は元の状態に復元する。プール内スレッドが使い回されても
 * 前リクエストの traceId が漏れないようにする。
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    private static final String THREAD_NAME_PREFIX = "photlas-async-";

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix(THREAD_NAME_PREFIX);
        executor.setTaskDecorator(mdcPropagatingTaskDecorator());
        executor.initialize();
        return executor;
    }

    /**
     * 呼び出し元スレッドの MDC を非同期スレッドへコピーし、
     * 実行後は元の状態（通常は空）へ戻す TaskDecorator。
     */
    private TaskDecorator mdcPropagatingTaskDecorator() {
        return runnable -> {
            Map<String, String> capturedContext = MDC.getCopyOfContextMap();
            return () -> {
                Map<String, String> previousContext = MDC.getCopyOfContextMap();
                try {
                    if (capturedContext != null) {
                        MDC.setContextMap(capturedContext);
                    } else {
                        MDC.clear();
                    }
                    runnable.run();
                } finally {
                    if (previousContext != null) {
                        MDC.setContextMap(previousContext);
                    } else {
                        MDC.clear();
                    }
                }
            };
        };
    }
}
