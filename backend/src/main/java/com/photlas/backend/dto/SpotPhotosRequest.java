package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * Issue#112: スポット写真ID一覧取得リクエスト DTO（ページネーション対応）
 *
 * POST /api/v1/spots/photos のリクエスト Body。
 * 複数スポットを横断して撮影日時降順でマージしたページを返す。
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
}
