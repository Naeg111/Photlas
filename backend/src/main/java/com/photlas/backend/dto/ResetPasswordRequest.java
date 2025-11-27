package com.photlas.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * パスワード再設定リクエストのDTO
 * Issue#6: パスワードリセット機能
 *
 * POST /api/v1/auth/reset-password のリクエストボディ
 */
public class ResetPasswordRequest {
    @NotBlank(message = "トークンは必須です")
    private String token;

    @NotBlank(message = "新しいパスワードは必須です")
    @Size(min = 8, message = "パスワードは8文字以上で入力してください")
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$",
        message = "パスワードは大文字、小文字、数字を含む必要があります"
    )
    private String newPassword;

    @NotBlank(message = "確認用パスワードは必須です")
    private String confirmPassword;

    public ResetPasswordRequest() {}

    public ResetPasswordRequest(String token, String newPassword, String confirmPassword) {
        this.token = token;
        this.newPassword = newPassword;
        this.confirmPassword = confirmPassword;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getNewPassword() {
        return newPassword;
    }

    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }

    public String getConfirmPassword() {
        return confirmPassword;
    }

    public void setConfirmPassword(String confirmPassword) {
        this.confirmPassword = confirmPassword;
    }

    @Override
    public String toString() {
        return "ResetPasswordRequest{" +
               "token='" + token + '\'' +
               ", newPassword='[PROTECTED]'" +
               ", confirmPassword='[PROTECTED]'" +
               '}';
    }
}
