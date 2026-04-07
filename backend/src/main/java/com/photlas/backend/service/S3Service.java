package com.photlas.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
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

    /** 写真アップロードの最大ファイルサイズ（50MB） */
    private static final long MAX_PHOTO_UPLOAD_SIZE = 50L * 1024 * 1024;

    /** アバター・プロフィール画像の最大ファイルサイズ（5MB） */
    private static final long MAX_AVATAR_UPLOAD_SIZE = 5L * 1024 * 1024;

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
     * Issue#62: S3オブジェクトを削除する
     * オブジェクトが存在しない場合もエラーにならない（S3の仕様で冪等）。
     *
     * @param s3ObjectKey 削除するS3オブジェクトキー
     */
    public void deleteS3Object(String s3ObjectKey) {
        try (S3Client s3Client = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build()) {

            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(s3ObjectKey)
                    .build();

            s3Client.deleteObject(deleteRequest);
        }
    }

    /**
     * S3上にオブジェクトが存在するか確認する（HeadObject）
     *
     * @param s3ObjectKey 確認するS3オブジェクトキー
     * @return 存在する場合true
     */
    public boolean existsInS3(String s3ObjectKey) {
        try (S3Client s3Client = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build()) {

            s3Client.headObject(software.amazon.awssdk.services.s3.model.HeadObjectRequest.builder()
                    .bucket(bucketName)
                    .key(s3ObjectKey)
                    .build());
            return true;
        } catch (software.amazon.awssdk.services.s3.model.NoSuchKeyException e) {
            return false;
        }
    }

    /**
     * Issue#59: S3オブジェクトキーからサムネイルのCDN URLを生成する
     * 命名規則: uploads/1/abc.jpg → thumbnails/uploads/1/abc.webp
     *
     * @param s3ObjectKey 元画像のS3オブジェクトキー
     * @return サムネイルのCDN URL
     */
    public String generateThumbnailCdnUrl(String s3ObjectKey) {
        if (s3ObjectKey == null) {
            return null;
        }
        int dotIndex = s3ObjectKey.lastIndexOf('.');
        String baseName = dotIndex > 0 ? s3ObjectKey.substring(0, dotIndex) : s3ObjectKey;
        String thumbnailKey = "thumbnails/" + baseName + ".webp";
        return generateCdnUrl(thumbnailKey);
    }

    /**
     * Issue#54: S3オブジェクトを別のキーに移動する（コピー＋削除）
     *
     * @param sourceKey 移動元のS3オブジェクトキー
     * @param destinationKey 移動先のS3オブジェクトキー
     */
    public void moveS3Object(String sourceKey, String destinationKey) {
        // TODO: Green段階で実装
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
