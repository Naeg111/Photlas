package com.photlas.backend.dto;

import com.photlas.backend.validation.ValidReportReason;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Issue#54: 通報リクエストDTO
 */
public class ReportRequest {

    @NotBlank(message = "理由は必須です")
    @ValidReportReason(message = "不正な通報理由です")
    private String reason;

    @Size(max = 300, message = "詳細は300文字以内で入力してください")
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
