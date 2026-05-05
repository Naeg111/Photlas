package com.photlas.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.rekognition.RekognitionClient;

import java.time.Duration;

/**
 * Issue#119: AWS Rekognition クライアントの Spring Bean 設定。
 *
 * <p>AWS SDK クライアントは長寿命設計（接続プール・認証情報キャッシュ）のため、
 * リクエスト毎に生成せず Spring Bean としてシングルトン化する。</p>
 *
 * <p>認証情報は {@link DefaultCredentialsProvider} で取得（EC2 インスタンスロール、
 * 環境変数、~/.aws/credentials 等から自動探索）。</p>
 */
@Configuration
public class AwsRekognitionConfig {

    /** Issue#119 4.9: 既存の S3・EC2 と同じ東京リージョン。 */
    @Value("${aws.rekognition.region:ap-northeast-1}")
    private String region;

    /** Issue#119 4.4: API 呼び出し全体（接続 + リトライ含む）の上限 10 秒。
     *  超過時は AWS SDK が例外を投げ、PhotoAnalyzeService が空レスポンスでフォールバックする。 */
    private static final Duration API_CALL_TIMEOUT = Duration.ofSeconds(10);

    @Bean(destroyMethod = "close")
    public RekognitionClient rekognitionClient() {
        return RekognitionClient.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .overrideConfiguration(ClientOverrideConfiguration.builder()
                        .apiCallTimeout(API_CALL_TIMEOUT)
                        .build())
                .build();
    }
}
