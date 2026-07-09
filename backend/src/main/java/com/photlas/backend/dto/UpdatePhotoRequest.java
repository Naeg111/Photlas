package com.photlas.backend.dto;

import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Issue#61: 写真メタデータ更新リクエストDTO
 */
public class UpdatePhotoRequest {

    private List<String> categories;

    private Integer weather;

    @Size(max = 100, message = "施設名・店名は100文字以内で入力してください")
    private String placeName;

    /**
     * Issue#135 追補（編集対応）: 詳細カテゴリー（キーワード）の tagId 群。
     * {@code null} なら変更なし、空リストなら全消去、要素があればその内容へ置き換える。
     */
    private List<Long> tagIds;

    public List<String> getCategories() {
        return categories;
    }

    public void setCategories(List<String> categories) {
        this.categories = categories;
    }

    public List<Long> getTagIds() {
        return tagIds;
    }

    public void setTagIds(List<Long> tagIds) {
        this.tagIds = tagIds;
    }

    public Integer getWeather() {
        return weather;
    }

    public void setWeather(Integer weather) {
        this.weather = weather;
    }

    public String getPlaceName() {
        return placeName;
    }

    public void setPlaceName(String placeName) {
        this.placeName = placeName;
    }
}
