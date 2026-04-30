package com.photlas.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#100: S3Service のタグベース孤立ファイル対応のテスト
 *
 * - タグ定数の定義
 * - updateObjectTag メソッドの存在
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
}
