package com.photlas.backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * SNSリンク更新リクエストDTO
 * Issue#29: プロフィール機能強化
 */
public class UpdateSnsLinksRequest {

    @NotNull
    @Size(max = 4, message = "SNSリンクは最大4件までです")
    @Valid
    private List<SnsLinkRequest> snsLinks;

    public UpdateSnsLinksRequest() {
    }

    public UpdateSnsLinksRequest(List<SnsLinkRequest> snsLinks) {
        this.snsLinks = snsLinks;
    }

    public List<SnsLinkRequest> getSnsLinks() {
        return snsLinks;
    }

    public void setSnsLinks(List<SnsLinkRequest> snsLinks) {
        this.snsLinks = snsLinks;
    }

    public static class SnsLinkRequest {
        @NotNull(message = "プラットフォームは必須です")
        private Integer platform;

        @NotNull(message = "URLは必須です")
        private String url;

        public SnsLinkRequest() {
        }

        public SnsLinkRequest(Integer platform, String url) {
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
}
