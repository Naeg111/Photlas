package com.photlas.backend.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * レート制限の設定
 * Issue#22: API Rate Limiting の実装
 */
@Configuration
public class RateLimitConfig {

    /**
     * 認証エンドポイントのレート制限: 10リクエスト/分
     */
    public static final int AUTH_RATE_LIMIT = 10;

    /**
     * 写真エンドポイントのレート制限: 30リクエスト/分
     */
    public static final int PHOTO_RATE_LIMIT = 30;

    /**
     * 一般エンドポイントのレート制限: 60リクエスト/分
     */
    public static final int GENERAL_RATE_LIMIT = 60;

    /**
     * リフィル期間: 1分
     */
    private static final Duration REFILL_DURATION = Duration.ofMinutes(1);

    /**
     * 指定されたレート制限でToken Bucket を作成する
     *
     * Token Bucketアルゴリズムを使用し、指定された制限値でBucketインスタンスを生成します。
     * Bucketの容量とリフィル数は同じ値に設定され、1分ごとに全トークンが補充されます。
     *
     * @param limit 1分あたりのリクエスト上限（Bucketの容量およびリフィル数）
     * @return Bucket4jのBucketインスタンス
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
