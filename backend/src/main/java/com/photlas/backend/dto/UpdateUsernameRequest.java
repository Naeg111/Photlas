package com.photlas.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * ユーザー名更新リクエストDTO
 * Issue#29: プロフィール機能強化
 */
public class UpdateUsernameRequest {

    @NotBlank(message = "ユーザー名は必須です")
    @Size(min = 1, max = 30, message = "ユーザー名は1〜30文字で入力してください")
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
