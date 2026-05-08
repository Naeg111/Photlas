package com.photlas.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

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
