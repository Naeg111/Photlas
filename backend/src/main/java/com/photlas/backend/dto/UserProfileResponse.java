package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.ALWAYS)
public class UserProfileResponse {
    private Long userId;
    private String username;
    private String email; // GET /users/me のみ
    private String language; // GET /users/me のみ
    private String profileImageUrl;
    private List<SnsLink> snsLinks;
    // Issue#104: 利用規約・プライバシーポリシーへの同意要否（GET /users/me のみ）
    private boolean requiresTermsAgreement;
    // Issue#104: 仮表示名状態フラグ（GET /users/me のみ。F5 エッジケース対応）
    private boolean usernameTemporary;

    public static class SnsLink {
        private Integer platform;
        private String url;

        public SnsLink() {}

        public SnsLink(Integer platform, String url) {
            this.platform = platform;
            this.url = url;
        }

        public Integer getPlatform() {
            return platform;
        }

        public void setPlatform(Integer platform) {
            this.platform = platform;
        }

        public String getUrl() {
            return url;
        }

        public void setUrl(String url) {
            this.url = url;
        }
    }

    public UserProfileResponse() {}

    public UserProfileResponse(Long userId, String username, String email, String language, String profileImageUrl, List<SnsLink> snsLinks) {
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.language = language;
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

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
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

    public boolean isRequiresTermsAgreement() {
        return requiresTermsAgreement;
    }

    public void setRequiresTermsAgreement(boolean requiresTermsAgreement) {
        this.requiresTermsAgreement = requiresTermsAgreement;
    }

    public boolean isUsernameTemporary() {
        return usernameTemporary;
    }

    public void setUsernameTemporary(boolean usernameTemporary) {
        this.usernameTemporary = usernameTemporary;
    }
}
