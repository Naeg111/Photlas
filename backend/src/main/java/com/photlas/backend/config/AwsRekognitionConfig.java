package com.photlas.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.rekognition.RekognitionClient;

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

    @Bean(destroyMethod = "close")
    public RekognitionClient rekognitionClient() {
        return RekognitionClient.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build();
    }
}
