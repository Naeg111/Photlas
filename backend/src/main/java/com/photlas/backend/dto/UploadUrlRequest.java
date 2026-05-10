package com.photlas.backend.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public class UploadUrlRequest {
    @NotNull(message = "拡張子は必須です")
    private String extension;

    @NotNull(message = "コンテンツタイプは必須です")
    @Pattern(regexp = "^image/(jpeg|png|webp|heic)$", message = "対応していないコンテンツタイプです")
    private String contentType;

    // Issue#131: ユーザー指定のクロップ範囲（投稿写真のみ・avatar 等は null）
    // 値はバックエンドでクランプして S3 metadata に渡される
    private Double cropCenterX;
    private Double cropCenterY;
    private Double cropZoom;

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

    public Double getCropCenterX() {
        return cropCenterX;
    }

    public void setCropCenterX(Double cropCenterX) {
        this.cropCenterX = cropCenterX;
    }

    public Double getCropCenterY() {
        return cropCenterY;
    }

    public void setCropCenterY(Double cropCenterY) {
        this.cropCenterY = cropCenterY;
    }

    public Double getCropZoom() {
        return cropZoom;
    }

    public void setCropZoom(Double cropZoom) {
        this.cropZoom = cropZoom;
    }
}
