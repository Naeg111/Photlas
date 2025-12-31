package com.photlas.backend.entity;

/**
 * Issue#19: レポート理由のEnum
 */
public enum ReportReason {
    INAPPROPRIATE_CONTENT("不適切なコンテンツ"),
    PRIVACY_VIOLATION("プライバシーの侵害"),
    WRONG_LOCATION("場所が違う"),
    COPYRIGHT_INFRINGEMENT("著作権侵害");

    private final String displayName;

    ReportReason(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
