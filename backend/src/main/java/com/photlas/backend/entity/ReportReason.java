package com.photlas.backend.entity;

/**
 * Issue#54: 通報理由のEnum
 */
public enum ReportReason {
    ADULT_CONTENT("成人向け"),
    VIOLENCE("暴力的"),
    COPYRIGHT_INFRINGEMENT("著作権侵害"),
    PRIVACY_VIOLATION("プライバシー侵害"),
    SPAM("スパム"),
    OTHER("その他");

    private final String displayName;

    ReportReason(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
