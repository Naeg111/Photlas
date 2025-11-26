package com.photlas.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * パスワードリセットリクエストのDTO
 * Issue#6: パスワードリセット機能
 *
 * POST /api/v1/auth/password-reset-request のリクエストボディ
 */
public class PasswordResetRequest {
    @NotBlank(message = "メールアドレスは必須です")
    @Email(message = "正しいメールアドレス形式で入力してください")
    private String email;

    public PasswordResetRequest() {}

    public PasswordResetRequest(String email) {
        this.email = email;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    @Override
    public String toString() {
        return "PasswordResetRequest{" +
               "email='" + email + '\'' +
               '}';
    }
}
