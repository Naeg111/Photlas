package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;

/**
 * Issue#20: アカウント設定機能 - パスワード変更リクエスト
 * Issue#21: パスワードバリデーション統一
 */
public class UpdatePasswordRequest {
    @JsonProperty("current_password")
    @NotNull(message = "Current password is required")
    private String currentPassword;

    @JsonProperty("new_password")
    @NotNull(message = "New password is required")
    @Size(min = 8, max = 20, message = "Password must be between 8 and 20 characters")
    // Issue#21: パスワードバリデーション統一 - 記号禁止、英数字のみ
    @Pattern(
        regexp = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])[A-Za-z0-9]+$",
        message = "Password must contain at least one digit, one lowercase letter, one uppercase letter, and no special characters"
    )
    private String newPassword;

    @JsonProperty("new_password_confirm")
    @NotNull(message = "Password confirmation is required")
    private String newPasswordConfirm;

    public UpdatePasswordRequest() {}

    public UpdatePasswordRequest(String currentPassword, String newPassword, String newPasswordConfirm) {
        this.currentPassword = currentPassword;
        this.newPassword = newPassword;
        this.newPasswordConfirm = newPasswordConfirm;
    }

    // Getters and Setters
    public String getCurrentPassword() {
        return currentPassword;
    }

    public void setCurrentPassword(String currentPassword) {
        this.currentPassword = currentPassword;
    }

    public String getNewPassword() {
        return newPassword;
    }

    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }

    public String getNewPasswordConfirm() {
        return newPasswordConfirm;
    }

    public void setNewPasswordConfirm(String newPasswordConfirm) {
        this.newPasswordConfirm = newPasswordConfirm;
    }
}
