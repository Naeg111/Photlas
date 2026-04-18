package com.photlas.backend.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * レート制限の設定
 * Issue#22: API Rate Limiting の実装
 * Issue#95: sensitive カテゴリ新設、general のデフォルトを 80 に引き上げ
 */
@Configuration
public class RateLimitConfig {

    /**
     * 認証エンドポイントのレート制限（デフォルト: 10リクエスト/分）
     */
    private static int authRateLimit = 10;

    /**
     * Issue#95: センシティブエンドポイント（メール送信系）のレート制限（デフォルト: 3リクエスト/分）
     */
    private static int sensitiveRateLimit = 3;

    /**
     * 写真エンドポイントのレート制限（デフォルト: 30リクエスト/分）
     */
    private static int photoRateLimit = 30;

    /**
     * 一般エンドポイントのレート制限（デフォルト: 80リクエスト/分、Issue#95 で 60→80）
     */
    private static int generalRateLimit = 80;

    @Value("${rate-limit.auth:10}")
    public void setAuthRateLimit(int limit) {
        authRateLimit = limit;
    }

    @Value("${rate-limit.sensitive:3}")
    public void setSensitiveRateLimit(int limit) {
        sensitiveRateLimit = limit;
    }

    @Value("${rate-limit.photo:30}")
    public void setPhotoRateLimit(int limit) {
        photoRateLimit = limit;
    }

    @Value("${rate-limit.general:80}")
    public void setGeneralRateLimit(int limit) {
        generalRateLimit = limit;
    }

    public static int getAuthRateLimit() {
        return authRateLimit;
    }

    public static int getSensitiveRateLimit() {
        return sensitiveRateLimit;
    }

    public static int getPhotoRateLimit() {
        return photoRateLimit;
    }

    public static int getGeneralRateLimit() {
        return generalRateLimit;
    }

    /**
     * リフィル期間: 1分
     */
    private static final Duration REFILL_DURATION = Duration.ofMinutes(1);

    /**
     * 指定されたレート制限で Token Bucket を作成する
     *
     * @param limit 1 分あたりのリクエスト上限
     * @return Bucket4j の Bucket インスタンス
     */
    public static Bucket createBucket(int limit) {
        Bandwidth bandwidth = Bandwidth.builder()
                .capacity(limit)
                .refillIntervally(limit, REFILL_DURATION)
                .build();

        return Bucket.builder()
                .addLimit(bandwidth)
                .build();
    }
}
