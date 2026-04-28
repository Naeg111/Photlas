package com.photlas.backend.dto;

import com.photlas.backend.validation.ValidUsername;

/**
 * 表示名更新リクエストDTO
 * Issue#29: プロフィール機能強化
 * Issue#98: username バリデーション強化 - @ValidUsername で統一（@NotBlank/@Size を削除）
 */
public class UpdateUsernameRequest {

    @ValidUsername
    private String username;

    public UpdateUsernameRequest() {
    }

    public UpdateUsernameRequest(String username) {
        this.username = username;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }
}
