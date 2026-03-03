package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;

/**
 * Issue#20: アカウント設定機能 - パスワード変更リクエスト
 * Issue#21: パスワードバリデーション統一
 */
public class UpdatePasswordRequest {
    @JsonProperty("current_password")
    @NotNull(message = "現在のパスワードは必須です")
    private String currentPassword;

    @JsonProperty("new_password")
    @NotNull(message = "新しいパスワードは必須です")
    @Size(min = 8, max = 20, message = "パスワードは8文字以上20文字以内で入力してください")
    // Issue#21: パスワードバリデーション統一 - 記号禁止、英数字のみ
    @Pattern(
        regexp = "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])[A-Za-z0-9]+$",
        message = "パスワードには数字・小文字・大文字をそれぞれ1文字以上含め、記号は使用できません"
    )
    private String newPassword;

    @JsonProperty("new_password_confirm")
    @NotNull(message = "パスワード（確認用）は必須です")
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
