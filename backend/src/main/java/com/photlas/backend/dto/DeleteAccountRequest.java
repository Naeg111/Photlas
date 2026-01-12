package com.photlas.backend.dto;

import jakarta.validation.constraints.*;

/**
 * Issue#20: アカウント設定機能 - アカウント削除リクエスト
 */
public class DeleteAccountRequest {
    @NotNull(message = "Password is required")
    private String password;

    public DeleteAccountRequest() {}

    public DeleteAccountRequest(String password) {
        this.password = password;
    }

    // Getters and Setters
    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
