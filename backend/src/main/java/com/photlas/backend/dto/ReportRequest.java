package com.photlas.backend.dto;

import com.photlas.backend.validation.ValidReportReason;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Issue#54: 通報リクエストDTO
 * Issue#87: reason を数値コード（800番台）に変更
 */
public class ReportRequest {

    @NotNull(message = "理由は必須です")
    @ValidReportReason(message = "不正な通報理由です")
    private Integer reason;

    @Size(max = 300, message = "詳細は300文字以内で入力してください")
    private String details;

    public ReportRequest() {
    }

    public ReportRequest(Integer reason, String details) {
        this.reason = reason;
        this.details = details;
    }

    public Integer getReason() {
        return reason;
    }

    public void setReason(Integer reason) {
        this.reason = reason;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }
}
