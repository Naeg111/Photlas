package com.photlas.backend.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * プロフィール画像更新リクエストDTO
 * Issue#29: プロフィール機能強化
 */
public class UpdateProfileImageRequest {

    @NotBlank(message = "objectKeyは必須です")
    private String objectKey;

    public UpdateProfileImageRequest() {
    }

    public UpdateProfileImageRequest(String objectKey) {
        this.objectKey = objectKey;
    }

    public String getObjectKey() {
        return objectKey;
    }

    public void setObjectKey(String objectKey) {
        this.objectKey = objectKey;
    }
}
