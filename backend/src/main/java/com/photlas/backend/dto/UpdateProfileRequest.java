package com.photlas.backend.dto;

import com.photlas.backend.validation.ValidUsername;

/**
 * Issue#98: username バリデーション強化 - @ValidUsername で統一（@NotNull/@Size を削除）
 */
public class UpdateProfileRequest {
    @ValidUsername
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
