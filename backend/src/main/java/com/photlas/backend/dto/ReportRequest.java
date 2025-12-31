package com.photlas.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Issue#19: レポート作成リクエストDTO
 */
public class ReportRequest {

    @NotBlank(message = "理由は必須です")
    private String reason;

    @NotBlank(message = "詳細は必須です")
    @Size(min = 1, max = 300, message = "詳細は1文字以上300文字以内で入力してください")
    private String details;

    public ReportRequest() {
    }

    public ReportRequest(String reason, String details) {
        this.reason = reason;
        this.details = details;
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
