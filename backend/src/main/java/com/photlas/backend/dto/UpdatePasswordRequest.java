package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;

/**
 * Issue#20: アカウント設定機能 - パスワード変更リクエスト
 *
 * Note: パスワードバリデーションの詳細（8〜20文字、記号禁止）については
 * Issue#21で対応予定。現在は既存の実装を使用。
 */
public class UpdatePasswordRequest {
    @JsonProperty("current_password")
    @NotNull(message = "Current password is required")
    private String currentPassword;

    @JsonProperty("new_password")
    @NotNull(message = "New password is required")
    @Size(min = 8, max = 20, message = "Password must be between 8 and 20 characters")
    @Pattern(
        regexp = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z]).+$",
        message = "Password must contain at least one digit, one lowercase letter, and one uppercase letter"
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
