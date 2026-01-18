package com.photlas.backend.dto;

/**
 * プロフィール画像更新レスポンスDTO
 * Issue#29: プロフィール機能強化
 */
public class UpdateProfileImageResponse {

    private String profileImageUrl;

    public UpdateProfileImageResponse() {
    }

    public UpdateProfileImageResponse(String profileImageUrl) {
        this.profileImageUrl = profileImageUrl;
    }

    public String getProfileImageUrl() {
        return profileImageUrl;
    }

    public void setProfileImageUrl(String profileImageUrl) {
        this.profileImageUrl = profileImageUrl;
    }
}
