package com.photlas.backend.dto;

/**
 * Issue#20: アカウント設定機能 - メールアドレス変更レスポンス
 */
public class UpdateEmailResponse {
    private String email;

    public UpdateEmailResponse() {}

    public UpdateEmailResponse(String email) {
        this.email = email;
    }

    // Getters and Setters
    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }
}
