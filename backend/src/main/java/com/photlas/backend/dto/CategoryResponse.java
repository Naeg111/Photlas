package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Issue#16: カテゴリー一覧API - レスポンスDTO
 * フロントエンドでカテゴリー名からIDへのマッピングを行うために使用
 */
public class CategoryResponse {

    @JsonProperty("categoryId")
    private Integer categoryId;

    @JsonProperty("name")
    private String name;

    public CategoryResponse() {
    }

    public CategoryResponse(Integer categoryId, String name) {
        this.categoryId = categoryId;
        this.name = name;
    }

    // Getters and Setters
    public Integer getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(Integer categoryId) {
        this.categoryId = categoryId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
