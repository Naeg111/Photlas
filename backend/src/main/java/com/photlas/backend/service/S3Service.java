package com.photlas.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.UUID;

/**
 * S3サービス
 * AWS S3への画像アップロード用の署名付きURL生成とCDN URL生成を提供します。
 */
@Service
public class S3Service {

    private static final int PRESIGNED_URL_EXPIRATION_MINUTES = 10;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    @Value("${aws.s3.region}")
    private String region;

    @Value("${aws.s3.cloudfront-domain}")
    private String cloudFrontDomain;

    /**
     * S3署名付きアップロードURLを生成する
     *
     * @param folder アップロード先フォルダ（例: "uploads", "avatars"）
     * @param userId ユーザーID
     * @param extension ファイル拡張子
     * @param contentType コンテンツタイプ
     * @return 署名付きURLとオブジェクトキーを含むレスポンス
     */
    public UploadUrlResult generatePresignedUploadUrl(String folder, Long userId, String extension, String contentType) {
        // オブジェクトキーを生成: folder/userId/uuid.extension
        String objectKey = String.format("%s/%d/%s.%s", folder, userId, UUID.randomUUID(), extension);

        try (S3Presigner presigner = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build()) {

            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .contentType(contentType)
                    .build();

            PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(PRESIGNED_URL_EXPIRATION_MINUTES))
                    .putObjectRequest(putObjectRequest)
                    .build();

            PresignedPutObjectRequest presignedRequest = presigner.presignPutObject(presignRequest);
            String uploadUrl = presignedRequest.url().toString();

            return new UploadUrlResult(uploadUrl, objectKey);
        }
    }

    /**
     * S3オブジェクトキーからCDN URLを生成する
     *
     * @param s3ObjectKey S3オブジェクトキー
     * @return CDN URL（CloudFrontが設定されている場合）またはS3 URL
     */
    public String generateCdnUrl(String s3ObjectKey) {
        if (s3ObjectKey == null) {
            return null;
        }

        if (cloudFrontDomain != null && !cloudFrontDomain.isEmpty()) {
            // CloudFrontドメインが設定されている場合
            return String.format("https://%s/%s", cloudFrontDomain, s3ObjectKey);
        } else {
            // CloudFrontが設定されていない場合はS3 URLを返す
            return String.format("https://%s.s3.%s.amazonaws.com/%s", bucketName, region, s3ObjectKey);
        }
    }

    /**
     * 署名付きURL生成結果を保持するクラス
     */
    public static class UploadUrlResult {
        private final String uploadUrl;
        private final String objectKey;

        public UploadUrlResult(String uploadUrl, String objectKey) {
            this.uploadUrl = uploadUrl;
            this.objectKey = objectKey;
        }

        public String getUploadUrl() {
            return uploadUrl;
        }

        public String getObjectKey() {
            return objectKey;
        }
    }
}
