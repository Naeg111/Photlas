package com.photlas.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * Issue#59: S3ServiceのサムネイルURL生成テスト
 */
public class S3ServiceThumbnailTest {

    @Test
    @DisplayName("Issue#59 - JPEGのS3キーからサムネイルCDN URLが生成される")
    void generateThumbnailCdnUrl_jpeg() {
        S3Service s3Service = new S3Service();
        setField(s3Service, "cloudFrontDomain", "cdn.photlas.jp");

        String result = s3Service.generateThumbnailCdnUrl("uploads/1/abc123.jpg");

        assertEquals("https://cdn.photlas.jp/thumbnails/uploads/1/abc123.webp", result);
    }

    @Test
    @DisplayName("Issue#59 - PNGのS3キーからサムネイルCDN URLが生成される")
    void generateThumbnailCdnUrl_png() {
        S3Service s3Service = new S3Service();
        setField(s3Service, "cloudFrontDomain", "cdn.photlas.jp");

        String result = s3Service.generateThumbnailCdnUrl("uploads/1/abc123.png");

        assertEquals("https://cdn.photlas.jp/thumbnails/uploads/1/abc123.webp", result);
    }

    @Test
    @DisplayName("Issue#59 - HEICのS3キーからサムネイルCDN URLが生成される")
    void generateThumbnailCdnUrl_heic() {
        S3Service s3Service = new S3Service();
        setField(s3Service, "cloudFrontDomain", "cdn.photlas.jp");

        String result = s3Service.generateThumbnailCdnUrl("uploads/1/abc123.heic");

        assertEquals("https://cdn.photlas.jp/thumbnails/uploads/1/abc123.webp", result);
    }

    @Test
    @DisplayName("Issue#59 - nullが渡された場合はnullを返す")
    void generateThumbnailCdnUrl_null() {
        S3Service s3Service = new S3Service();
        setField(s3Service, "cloudFrontDomain", "cdn.photlas.jp");

        String result = s3Service.generateThumbnailCdnUrl(null);

        assertNull(result);
    }

    /**
     * リフレクションでprivateフィールドに値を設定するヘルパー
     */
    private void setField(Object target, String fieldName, String value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
