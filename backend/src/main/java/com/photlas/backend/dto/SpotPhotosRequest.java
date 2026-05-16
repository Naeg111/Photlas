package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Issue#112 + Issue#141: スポット写真ID一覧取得リクエスト DTO（ページネーション対応）
 *
 * POST /api/v1/spots/photos のリクエスト Body。
 * 複数スポットを横断して撮影日時降順でマージしたページを返す。
 *
 * <p>Issue#141: tag_ids + 既存全フィルタを追加 (Q-new-6/7)。フィルタはフロントの
 * FilterPanel と同じ条件を引き継ぐ。null/未指定は「フィルタ無し」として扱われる。</p>
 */
public class SpotPhotosRequest {

    @NotEmpty(message = "spotIds は1件以上必須です")
    @JsonProperty("spotIds")
    private List<Long> spotIds;

    @Min(value = 1, message = "limit は1以上にしてください")
    @Max(value = 100, message = "limit は100以下にしてください")
    @JsonProperty("limit")
    private Integer limit;

    @Min(value = 0, message = "offset は0以上にしてください")
    @JsonProperty("offset")
    private Integer offset;

    @Min(value = 0, message = "maxAgeDays は0以上にしてください")
    @JsonProperty("maxAgeDays")
    private Integer maxAgeDays;

    // Issue#141: 既存フィルタ全部 (null/空なら「フィルタ無し」扱い)
    @JsonProperty("subjectCategories")
    private List<Integer> subjectCategories;

    @JsonProperty("months")
    private List<Integer> months;

    @JsonProperty("timesOfDay")
    private List<Integer> timesOfDay;

    @JsonProperty("weathers")
    private List<Integer> weathers;

    @JsonProperty("minResolution")
    private Integer minResolution;

    @JsonProperty("deviceTypes")
    private List<Integer> deviceTypes;

    @JsonProperty("aspectRatios")
    private List<String> aspectRatios;

    @JsonProperty("focalLengthRanges")
    private List<String> focalLengthRanges;

    @JsonProperty("maxIso")
    private Integer maxIso;

    @JsonProperty("tagIds")
    private List<Long> tagIds;

    public SpotPhotosRequest() {}

    public List<Long> getSpotIds() {
        return spotIds;
    }

    public void setSpotIds(List<Long> spotIds) {
        this.spotIds = spotIds;
    }

    public Integer getLimit() {
        return limit;
    }

    public void setLimit(Integer limit) {
        this.limit = limit;
    }

    public Integer getOffset() {
        return offset;
    }

    public void setOffset(Integer offset) {
        this.offset = offset;
    }

    public Integer getMaxAgeDays() {
        return maxAgeDays;
    }

    public void setMaxAgeDays(Integer maxAgeDays) {
        this.maxAgeDays = maxAgeDays;
    }

    public List<Integer> getSubjectCategories() { return subjectCategories; }
    public void setSubjectCategories(List<Integer> subjectCategories) { this.subjectCategories = subjectCategories; }

    public List<Integer> getMonths() { return months; }
    public void setMonths(List<Integer> months) { this.months = months; }

    public List<Integer> getTimesOfDay() { return timesOfDay; }
    public void setTimesOfDay(List<Integer> timesOfDay) { this.timesOfDay = timesOfDay; }

    public List<Integer> getWeathers() { return weathers; }
    public void setWeathers(List<Integer> weathers) { this.weathers = weathers; }

    public Integer getMinResolution() { return minResolution; }
    public void setMinResolution(Integer minResolution) { this.minResolution = minResolution; }

    public List<Integer> getDeviceTypes() { return deviceTypes; }
    public void setDeviceTypes(List<Integer> deviceTypes) { this.deviceTypes = deviceTypes; }

    public List<String> getAspectRatios() { return aspectRatios; }
    public void setAspectRatios(List<String> aspectRatios) { this.aspectRatios = aspectRatios; }

    public List<String> getFocalLengthRanges() { return focalLengthRanges; }
    public void setFocalLengthRanges(List<String> focalLengthRanges) { this.focalLengthRanges = focalLengthRanges; }

    public Integer getMaxIso() { return maxIso; }
    public void setMaxIso(Integer maxIso) { this.maxIso = maxIso; }

    public List<Long> getTagIds() { return tagIds; }
    public void setTagIds(List<Long> tagIds) { this.tagIds = tagIds; }
}
