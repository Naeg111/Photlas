package com.photlas.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public class UpdateProfileRequest {
    @NotNull(message = "ユーザー名は必須です")
    @Size(min = 2, max = 12, message = "ユーザー名は2〜12文字で入力してください")
    private String username;

    @Size(max = 3, message = "SNSリンクは最大3件まで登録できます")
    private List<SnsLinkRequest> snsLinks;

    private String profileImageS3Key;

    public static class SnsLinkRequest {
        @Size(max = 2048, message = "URLは2048文字以内で入力してください")
        private String url;

        public SnsLinkRequest() {}

        public SnsLinkRequest(String url) {
            this.url = url;
        }

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }
    }

    public UpdateProfileRequest() {}

    public UpdateProfileRequest(String username, List<SnsLinkRequest> snsLinks, String profileImageS3Key) {
        this.username = username;
        this.snsLinks = snsLinks;
        this.profileImageS3Key = profileImageS3Key;
    }

    // Getters and Setters
    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public List<SnsLinkRequest> getSnsLinks() {
        return snsLinks;
    }

    public void setSnsLinks(List<SnsLinkRequest> snsLinks) {
        this.snsLinks = snsLinks;
    }

    public String getProfileImageS3Key() {
        return profileImageS3Key;
    }

    public void setProfileImageS3Key(String profileImageS3Key) {
        this.profileImageS3Key = profileImageS3Key;
    }
}
