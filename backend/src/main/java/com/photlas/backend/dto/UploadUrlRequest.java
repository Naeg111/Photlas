package com.photlas.backend.dto;

import jakarta.validation.constraints.NotNull;

public class UploadUrlRequest {
    @NotNull(message = "拡張子は必須です")
    private String extension;

    @NotNull(message = "コンテンツタイプは必須です")
    private String contentType;

    public UploadUrlRequest() {}

    public UploadUrlRequest(String extension, String contentType) {
        this.extension = extension;
        this.contentType = contentType;
    }

    public String getExtension() {
        return extension;
    }

    public void setExtension(String extension) {
        this.extension = extension;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }
}
