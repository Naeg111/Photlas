package com.photlas.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#100: S3Service のタグベース孤立ファイル対応のテスト
 * Issue#124: 写真画像の Cache-Control を immutable 化のテスト
 *
 * - タグ定数の定義
 * - updateObjectTag メソッドの存在
 * - Cache-Control 定数の定義
 * - presigned URL の SignedHeaders に cache-control が含まれる
 *
 * 注: presigned URL の実際のタグ署名テストは AWS 認証情報が必要なため、
 * 手動検証（Issue#100 セクション 7.2）で行う。
 * Issue#124 では SignedHeaders のクエリ文字列のみダミー認証情報で検証する
 * （presign は完全にローカルな署名処理なので実 AWS 接続は不要）。
 */
class S3ServiceTest {

    @Test
    @DisplayName("Issue#100 - タグ定数 STATUS_TAG_KEY が \"status\" として定義されている")
    void statusTagKeyConstantDefined() {
        assertThat(S3Service.STATUS_TAG_KEY).isEqualTo("status");
    }

    @Test
    @DisplayName("Issue#100 - タグ定数 STATUS_TAG_VALUE_PENDING が \"pending\" として定義されている")
    void statusTagValuePendingDefined() {
        assertThat(S3Service.STATUS_TAG_VALUE_PENDING).isEqualTo("pending");
    }

    @Test
    @DisplayName("Issue#100 - タグ定数 STATUS_TAG_VALUE_REGISTERED が \"registered\" として定義されている")
    void statusTagValueRegisteredDefined() {
        assertThat(S3Service.STATUS_TAG_VALUE_REGISTERED).isEqualTo("registered");
    }

    @Test
    @DisplayName("Issue#100 - updateObjectTag(String, String, String) メソッドが定義されている")
    void updateObjectTagMethodExists() throws NoSuchMethodException {
        // S3 への実呼び出しは行わず、メソッドシグネチャのみを検証
        S3Service.class.getMethod("updateObjectTag", String.class, String.class, String.class);
    }

    @Test
    @DisplayName("Issue#124 - 定数 S3_CACHE_CONTROL_VALUE が \"public, max-age=31536000, immutable\" として定義されている")
    void s3CacheControlValueConstantDefined() {
        assertThat(S3Service.S3_CACHE_CONTROL_VALUE).isEqualTo("public, max-age=31536000, immutable");
    }

    @Test
    @DisplayName("Issue#124 - generatePresignedUploadUrl が生成する URL の SignedHeaders に cache-control が含まれる")
    void presignedUrlIncludesCacheControlInSignedHeaders() throws Exception {
        // ダミー認証情報を system property で設定（presign は完全にローカル処理なので
        // 実 AWS 接続は不要。クレデンシャルが「あること」だけが必要）
        String prevAk = System.getProperty("aws.accessKeyId");
        String prevSk = System.getProperty("aws.secretAccessKey");
        System.setProperty("aws.accessKeyId", "test-access-key-id");
        System.setProperty("aws.secretAccessKey", "test-secret-access-key");
        try {
            S3Service s3Service = new S3Service();
            setField(s3Service, "bucketName", "test-bucket");
            setField(s3Service, "region", "ap-northeast-1");

            S3Service.UploadUrlResult result = s3Service.generatePresignedUploadUrl(
                    "uploads", 1L, "jpg", "image/jpeg");

            String url = result.getUploadUrl();
            URI uri = URI.create(url);
            String rawQuery = uri.getRawQuery();
            assertThat(rawQuery).isNotNull();

            // X-Amz-SignedHeaders=cache-control%3Bcontent-type%3Bhost%3Bx-amz-tagging のような形
            String signedHeadersValue = Arrays.stream(rawQuery.split("&"))
                    .filter(p -> p.startsWith("X-Amz-SignedHeaders="))
                    .map(p -> URLDecoder.decode(p.substring("X-Amz-SignedHeaders=".length()),
                            StandardCharsets.UTF_8))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("X-Amz-SignedHeaders がクエリに存在しない: " + rawQuery));

            // SignedHeaders は ; 区切りのヘッダー名一覧（小文字）
            assertThat(signedHeadersValue.split(";"))
                    .as("SignedHeaders に cache-control が含まれること: actual=%s", signedHeadersValue)
                    .contains("cache-control");
        } finally {
            restoreSystemProperty("aws.accessKeyId", prevAk);
            restoreSystemProperty("aws.secretAccessKey", prevSk);
        }
    }

    // ============================================================
    // Issue#131: presigned URL に crop メタデータを含めるテスト
    // ============================================================

    @Test
    @DisplayName("Issue#131 - buildPutObjectRequestForUpload に crop 情報を渡すと metadata に crop-center-x/y, crop-zoom が含まれ、%.4f でフォーマットされる")
    void buildPutObjectRequestIncludesCropMetadata() {
        S3Service s3Service = new S3Service();
        setField(s3Service, "bucketName", "test-bucket");

        PutObjectRequest request = s3Service.buildPutObjectRequestForUpload(
                "uploads/1/abc.jpg", "image/jpeg", 0.3, 0.7, 2.0);

        Map<String, String> metadata = request.metadata();
        assertThat(metadata).containsEntry("crop-center-x", "0.3000");
        assertThat(metadata).containsEntry("crop-center-y", "0.7000");
        assertThat(metadata).containsEntry("crop-zoom", "2.0000");
    }

    @Test
    @DisplayName("Issue#131 - crop 情報が null なら metadata に crop-* キーが含まれない（avatars 経路の互換）")
    void buildPutObjectRequestWithoutCropDoesNotIncludeMetadata() {
        S3Service s3Service = new S3Service();
        setField(s3Service, "bucketName", "test-bucket");

        PutObjectRequest request = s3Service.buildPutObjectRequestForUpload(
                "avatars/1/abc.jpg", "image/jpeg", null, null, null);

        Map<String, String> metadata = request.metadata();
        assertThat(metadata).doesNotContainKey("crop-center-x");
        assertThat(metadata).doesNotContainKey("crop-center-y");
        assertThat(metadata).doesNotContainKey("crop-zoom");
    }

    @Test
    @DisplayName("Issue#131 - cropCenterX が値域外 (1.5) なら 1.0 にクランプして metadata に入る")
    void buildPutObjectRequestClampsCropCenterX() {
        S3Service s3Service = new S3Service();
        setField(s3Service, "bucketName", "test-bucket");

        PutObjectRequest request = s3Service.buildPutObjectRequestForUpload(
                "uploads/1/abc.jpg", "image/jpeg", 1.5, 0.5, 2.0);

        Map<String, String> metadata = request.metadata();
        assertThat(metadata).containsEntry("crop-center-x", "1.0000");
    }

    @Test
    @DisplayName("Issue#131 - cropZoom が値域外 (5.0) なら 3.0 にクランプして metadata に入る")
    void buildPutObjectRequestClampsCropZoom() {
        S3Service s3Service = new S3Service();
        setField(s3Service, "bucketName", "test-bucket");

        PutObjectRequest request = s3Service.buildPutObjectRequestForUpload(
                "uploads/1/abc.jpg", "image/jpeg", 0.5, 0.5, 5.0);

        Map<String, String> metadata = request.metadata();
        assertThat(metadata).containsEntry("crop-zoom", "3.0000");
    }

    @Test
    @DisplayName("Issue#131 - generatePresignedUploadUrl の crop 情報付きオーバーロードで SignedHeaders に x-amz-meta-crop-* が含まれる")
    void presignedUrlWithCropIncludesMetadataInSignedHeaders() throws Exception {
        String prevAk = System.getProperty("aws.accessKeyId");
        String prevSk = System.getProperty("aws.secretAccessKey");
        System.setProperty("aws.accessKeyId", "test-access-key-id");
        System.setProperty("aws.secretAccessKey", "test-secret-access-key");
        try {
            S3Service s3Service = new S3Service();
            setField(s3Service, "bucketName", "test-bucket");
            setField(s3Service, "region", "ap-northeast-1");

            S3Service.UploadUrlResult result = s3Service.generatePresignedUploadUrl(
                    "uploads", 1L, "jpg", "image/jpeg", 0.3, 0.7, 2.0);

            URI uri = URI.create(result.getUploadUrl());
            String rawQuery = uri.getRawQuery();
            assertThat(rawQuery).isNotNull();

            String signedHeadersValue = Arrays.stream(rawQuery.split("&"))
                    .filter(p -> p.startsWith("X-Amz-SignedHeaders="))
                    .map(p -> URLDecoder.decode(p.substring("X-Amz-SignedHeaders=".length()),
                            StandardCharsets.UTF_8))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("X-Amz-SignedHeaders がクエリに存在しない: " + rawQuery));

            assertThat(signedHeadersValue.split(";"))
                    .as("SignedHeaders に x-amz-meta-crop-* が含まれること: actual=%s", signedHeadersValue)
                    .contains("x-amz-meta-crop-center-x", "x-amz-meta-crop-center-y", "x-amz-meta-crop-zoom");
        } finally {
            restoreSystemProperty("aws.accessKeyId", prevAk);
            restoreSystemProperty("aws.secretAccessKey", prevSk);
        }
    }

    @Test
    @DisplayName("Issue#131 - 既存 generatePresignedUploadUrl (crop 情報なし) の SignedHeaders に x-amz-meta-* が含まれない（avatars 経路の回帰）")
    void presignedUrlWithoutCropDoesNotIncludeCropMetadataInSignedHeaders() throws Exception {
        String prevAk = System.getProperty("aws.accessKeyId");
        String prevSk = System.getProperty("aws.secretAccessKey");
        System.setProperty("aws.accessKeyId", "test-access-key-id");
        System.setProperty("aws.secretAccessKey", "test-secret-access-key");
        try {
            S3Service s3Service = new S3Service();
            setField(s3Service, "bucketName", "test-bucket");
            setField(s3Service, "region", "ap-northeast-1");

            S3Service.UploadUrlResult result = s3Service.generatePresignedUploadUrl(
                    "avatars", 1L, "jpg", "image/jpeg");

            URI uri = URI.create(result.getUploadUrl());
            String rawQuery = uri.getRawQuery();
            assertThat(rawQuery).isNotNull();

            String signedHeadersValue = Arrays.stream(rawQuery.split("&"))
                    .filter(p -> p.startsWith("X-Amz-SignedHeaders="))
                    .map(p -> URLDecoder.decode(p.substring("X-Amz-SignedHeaders=".length()),
                            StandardCharsets.UTF_8))
                    .findFirst()
                    .orElseThrow(() -> new AssertionError("X-Amz-SignedHeaders がクエリに存在しない: " + rawQuery));

            assertThat(signedHeadersValue)
                    .as("avatars 経路は x-amz-meta-crop-* を含まない: actual=%s", signedHeadersValue)
                    .doesNotContain("x-amz-meta-crop");
        } finally {
            restoreSystemProperty("aws.accessKeyId", prevAk);
            restoreSystemProperty("aws.secretAccessKey", prevSk);
        }
    }

    private static void setField(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private static void restoreSystemProperty(String key, String previousValue) {
        if (previousValue == null) {
            System.clearProperty(key);
        } else {
            System.setProperty(key, previousValue);
        }
    }
}
