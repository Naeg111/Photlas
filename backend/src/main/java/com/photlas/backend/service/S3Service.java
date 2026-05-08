package com.photlas.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectTaggingRequest;
import software.amazon.awssdk.services.s3.model.Tag;
import software.amazon.awssdk.services.s3.model.Tagging;
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

    // Issue#100: S3 タグベース孤立ファイル対応
    /** タグキー: アップロード状態を表す */
    public static final String STATUS_TAG_KEY = "status";
    /** タグ値: アップロード完了済みだがメタデータ未登録（孤立ファイル候補） */
    public static final String STATUS_TAG_VALUE_PENDING = "pending";
    /** タグ値: メタデータ登録済み（保持対象） */
    public static final String STATUS_TAG_VALUE_REGISTERED = "registered";

    // Issue#124: 写真画像の Cache-Control を immutable 化
    /**
     * S3 オブジェクトに付与する Cache-Control 値。
     * フロントエンド (apiClient.ts の S3_CACHE_CONTROL_VALUE) と Lambda
     * (lambda_function.py の S3_CACHE_CONTROL_VALUE) と完全一致させる。
     * 変更時は 3 箇所同時に変えること。
     */
    public static final String S3_CACHE_CONTROL_VALUE = "public, max-age=31536000, immutable";

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

        // [一時デバッグ] PUT 失敗の原因調査用 - contentType が想定通りか確認するため
        org.slf4j.LoggerFactory.getLogger(S3Service.class).info(
                "[DEBUG-UPLOAD-URL] generatePresignedUploadUrl userId={} extension={} contentType=[{}] objectKey={}",
                userId, extension, contentType, objectKey);

        try (S3Presigner presigner = S3Presigner.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build()) {

            // Issue#100: presigned URL に status=pending タグを付与
            // フロントエンドはアップロード時に x-amz-tagging: status=pending ヘッダーを送る必要がある
            // Issue#124: CacheControl を署名対象に含めることで、PUT 後の S3 オブジェクトに
            // 永続キャッシュ (immutable) を付与する。フロントエンドはアップロード時に
            // Cache-Control ヘッダを送る必要がある（送らないと SignedHeaders 不一致で 403）。
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .contentType(contentType)
                    .cacheControl(S3_CACHE_CONTROL_VALUE)
                    .tagging(STATUS_TAG_KEY + "=" + STATUS_TAG_VALUE_PENDING)
                    .build();

            PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofMinutes(PRESIGNED_URL_EXPIRATION_MINUTES))
                    .putObjectRequest(putObjectRequest)
                    .build();

            PresignedPutObjectRequest presignedRequest = presigner.presignPutObject(presignRequest);
            String uploadUrl = presignedRequest.url().toString();

            // [一時デバッグ] 生成された URL を確認
            org.slf4j.LoggerFactory.getLogger(S3Service.class).info(
                    "[DEBUG-UPLOAD-URL] generated url={}", uploadUrl);

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
     * Issue#108: S3 オブジェクトの内容をバイト配列でダウンロードする。
     *
     * <p>ユーザーデータエクスポートで写真本体を ZIP に同梱する際に使用する。
     * 1 枚あたり最大 50MB（{@link #MAX_PHOTO_UPLOAD_SIZE}）を想定するため、
     * メモリへ全体を一度に読み込んでよい（ストリーミング処理側でメモリ使用量を
     * 並列度で制御する想定、§4.3 §4.5 参照）。</p>
     *
     * @param s3ObjectKey ダウンロードする S3 オブジェクトキー
     * @return オブジェクト本体のバイト配列
     * @throws software.amazon.awssdk.services.s3.model.NoSuchKeyException 存在しないキー
     * @throws software.amazon.awssdk.core.exception.SdkException その他の S3 エラー
     */
    public byte[] downloadObjectAsBytes(String s3ObjectKey) {
        try (S3Client s3Client = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build()) {

            software.amazon.awssdk.services.s3.model.GetObjectRequest getRequest =
                    software.amazon.awssdk.services.s3.model.GetObjectRequest.builder()
                            .bucket(bucketName)
                            .key(s3ObjectKey)
                            .build();

            return s3Client.getObjectAsBytes(getRequest).asByteArray();
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
     * Issue#100: S3オブジェクトのタグを更新する
     *
     * 単一のキー/値ペアでオブジェクトタギングを上書きする。
     * メタデータ登録成功時に status=registered へ更新するなどの用途で使用する。
     *
     * @param s3ObjectKey 対象 S3 オブジェクトキー
     * @param tagKey タグキー（例: "status"）
     * @param tagValue タグ値（例: "registered"）
     */
    public void updateObjectTag(String s3ObjectKey, String tagKey, String tagValue) {
        try (S3Client s3Client = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build()) {

            Tagging tagging = Tagging.builder()
                    .tagSet(Tag.builder().key(tagKey).value(tagValue).build())
                    .build();

            PutObjectTaggingRequest taggingRequest = PutObjectTaggingRequest.builder()
                    .bucket(bucketName)
                    .key(s3ObjectKey)
                    .tagging(tagging)
                    .build();

            s3Client.putObjectTagging(taggingRequest);
        }
    }

    /**
     * Issue#59: 元画像のS3キーからサムネイルのS3キーを導出する
     * 命名規則: uploads/1/abc.jpg → thumbnails/uploads/1/abc.webp
     *
     * Issue#100: PhotoService 等の他サービスからもサムネイルキーが必要になったため、
     * 命名規則の単一情報源として本メソッドに集約。Lambda 側 (lambda_function.py の
     * generate_thumbnail_key) と同じ規則を実装する。
     *
     * @param s3ObjectKey 元画像のS3オブジェクトキー
     * @return サムネイルのS3オブジェクトキー（拡張子は .webp）。入力が null の場合は null
     */
    public String deriveThumbnailKey(String s3ObjectKey) {
        if (s3ObjectKey == null) {
            return null;
        }
        int dotIndex = s3ObjectKey.lastIndexOf('.');
        String baseName = dotIndex > 0 ? s3ObjectKey.substring(0, dotIndex) : s3ObjectKey;
        return "thumbnails/" + baseName + ".webp";
    }

    /**
     * Issue#59: S3オブジェクトキーからサムネイルのCDN URLを生成する
     *
     * @param s3ObjectKey 元画像のS3オブジェクトキー
     * @return サムネイルのCDN URL
     */
    public String generateThumbnailCdnUrl(String s3ObjectKey) {
        String thumbnailKey = deriveThumbnailKey(s3ObjectKey);
        return thumbnailKey != null ? generateCdnUrl(thumbnailKey) : null;
    }

    /**
     * Issue#54: S3オブジェクトを別のキーに移動する（コピー＋削除）
     *
     * @param sourceKey 移動元のS3オブジェクトキー
     * @param destinationKey 移動先のS3オブジェクトキー
     */
    public void moveS3Object(String sourceKey, String destinationKey) {
        try (S3Client s3Client = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(DefaultCredentialsProvider.create())
                .build()) {

            CopyObjectRequest copyRequest = CopyObjectRequest.builder()
                    .sourceBucket(bucketName)
                    .sourceKey(sourceKey)
                    .destinationBucket(bucketName)
                    .destinationKey(destinationKey)
                    .build();

            s3Client.copyObject(copyRequest);

            DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(sourceKey)
                    .build();

            s3Client.deleteObject(deleteRequest);
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
