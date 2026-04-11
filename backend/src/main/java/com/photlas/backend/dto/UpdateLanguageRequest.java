package com.photlas.backend.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Issue#93: 言語設定変更リクエストDTO
 */
public class UpdateLanguageRequest {

    @NotBlank(message = "言語コードは必須です")
    private String language;

    public UpdateLanguageRequest() {}

    public String getLanguage() {
        return language;
    }

    public void setLanguage(String language) {
        this.language = language;
    }
}
