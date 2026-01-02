package com.photlas.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * パスワード再設定リクエストのDTO
 * Issue#6: パスワードリセット機能
 * Issue#21: パスワードバリデーション統一
 *
 * POST /api/v1/auth/reset-password のリクエストボディ
 */
public class ResetPasswordRequest {
    @NotBlank(message = "トークンは必須です")
    private String token;

    @NotBlank(message = "新しいパスワードは必須です")
    @Size(min = 8, max = 20, message = "パスワードは8〜20文字で入力してください")
    // Issue#21: パスワードバリデーション統一 - 記号禁止、英数字のみ
    @Pattern(
        regexp = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])[A-Za-z0-9]+$",
        message = "パスワードは数字・小文字・大文字をそれぞれ1文字以上含め、記号は使用できません"
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
