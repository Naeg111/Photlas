package com.photlas.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class UpdateProfileRequest {
    @NotNull(message = "ユーザー名は必須です")
    @Size(min = 2, max = 12, message = "ユーザー名は2〜12文字で入力してください")
    private String username;

    private String profileImageS3Key;

    public UpdateProfileRequest() {}

    public UpdateProfileRequest(String username, String profileImageS3Key) {
        this.username = username;
        this.profileImageS3Key = profileImageS3Key;
    }

    // Getters and Setters
    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getProfileImageS3Key() {
        return profileImageS3Key;
    }

    public void setProfileImageS3Key(String profileImageS3Key) {
        this.profileImageS3Key = profileImageS3Key;
    }
}
