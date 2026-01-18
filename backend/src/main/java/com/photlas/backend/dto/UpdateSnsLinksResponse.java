package com.photlas.backend.dto;

import java.util.List;

/**
 * SNSリンク更新レスポンスDTO
 * Issue#29: プロフィール機能強化
 */
public class UpdateSnsLinksResponse {

    private List<SnsLinkResponse> snsLinks;

    public UpdateSnsLinksResponse() {
    }

    public UpdateSnsLinksResponse(List<SnsLinkResponse> snsLinks) {
        this.snsLinks = snsLinks;
    }

    public List<SnsLinkResponse> getSnsLinks() {
        return snsLinks;
    }

    public void setSnsLinks(List<SnsLinkResponse> snsLinks) {
        this.snsLinks = snsLinks;
    }

    public static class SnsLinkResponse {
        private String platform;
        private String url;

        public SnsLinkResponse() {
        }

        public SnsLinkResponse(String platform, String url) {
            this.platform = platform;
            this.url = url;
        }

        public String getPlatform() {
            return platform;
        }

        public void setPlatform(String platform) {
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
