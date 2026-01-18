package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.ALWAYS)
public class UserProfileResponse {
    private Long userId;
    private String username;
    private String email; // GET /users/me のみ
    private String profileImageUrl;
    private List<SnsLink> snsLinks;

    public static class SnsLink {
        private String url;

        public SnsLink() {}

        public SnsLink(String url) {
            this.url = url;
        }

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }
    }

    public UserProfileResponse() {}

    public UserProfileResponse(Long userId, String username, String email, String profileImageUrl, List<SnsLink> snsLinks) {
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.profileImageUrl = profileImageUrl;
        this.snsLinks = snsLinks;
    }

    // Getters and Setters
    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getProfileImageUrl() {
        return profileImageUrl;
    }

    public void setProfileImageUrl(String profileImageUrl) {
        this.profileImageUrl = profileImageUrl;
    }

    public List<SnsLink> getSnsLinks() {
        return snsLinks;
    }

    public void setSnsLinks(List<SnsLink> snsLinks) {
        this.snsLinks = snsLinks;
    }
}
