package com.photlas.backend.dto;

/**
 * Issue#19: レポート作成レスポンスDTO
 */
public class ReportResponse {

    private Long reportingUserId;
    private Long photoId;
    private String reason;
    private String details;

    public ReportResponse() {
    }

    public ReportResponse(Long reportingUserId, Long photoId, String reason, String details) {
        this.reportingUserId = reportingUserId;
        this.photoId = photoId;
        this.reason = reason;
        this.details = details;
    }

    public Long getReportingUserId() {
        return reportingUserId;
    }

    public void setReportingUserId(Long reportingUserId) {
        this.reportingUserId = reportingUserId;
    }

    public Long getPhotoId() {
        return photoId;
    }

    public void setPhotoId(Long photoId) {
        this.photoId = photoId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }
}
