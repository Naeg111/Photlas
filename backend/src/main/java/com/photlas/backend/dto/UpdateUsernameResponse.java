package com.photlas.backend.dto;

/**
 * ユーザー名更新レスポンスDTO
 * Issue#29: プロフィール機能強化
 */
public class UpdateUsernameResponse {

    private String username;

    public UpdateUsernameResponse() {
    }

    public UpdateUsernameResponse(String username) {
        this.username = username;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }
}
