package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;

/**
 * Issue#20: アカウント設定機能 - メールアドレス変更リクエスト
 */
public class UpdateEmailRequest {
    @JsonProperty("new_email")
    @NotNull(message = "新しいメールアドレスは必須です")
    @Email(message = "正しいメールアドレスの形式で入力してください")
    private String newEmail;

    @JsonProperty("current_password")
    @NotNull(message = "現在のパスワードは必須です")
    private String currentPassword;

    public UpdateEmailRequest() {}

    public UpdateEmailRequest(String newEmail, String currentPassword) {
        this.newEmail = newEmail;
        this.currentPassword = currentPassword;
    }

    // Getters and Setters
    public String getNewEmail() {
        return newEmail;
    }

    public void setNewEmail(String newEmail) {
        this.newEmail = newEmail;
    }

    public String getCurrentPassword() {
        return currentPassword;
    }

    public void setCurrentPassword(String currentPassword) {
        this.currentPassword = currentPassword;
    }
}
