package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;

/**
 * Issue#20: アカウント設定機能 - メールアドレス変更リクエスト
 */
public class UpdateEmailRequest {
    @JsonProperty("new_email")
    @NotNull(message = "New email is required")
    @Email(message = "Email should be valid")
    private String newEmail;

    @JsonProperty("current_password")
    @NotNull(message = "Current password is required")
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
