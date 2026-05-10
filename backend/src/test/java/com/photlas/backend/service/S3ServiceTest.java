package com.photlas.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#100: S3Service のタグベース孤立ファイル対応のテスト
 * Issue#131: S3 メタデータ経由でユーザー指定範囲をクロップする対応のテスト
 *
 * - タグ定数の定義
 * - updateObjectTag メソッドの存在
 * - buildPutObjectRequestForUpload の crop メタデータ付与
 *
 * 注: presigned URL の実際のタグ署名テストは AWS 認証情報が必要なため、
 * 手動検証（Issue#100 セクション 7.2）で行う。
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

    private static void setField(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
