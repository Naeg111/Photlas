package com.photlas.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * Issue#112: スポット写真ID一覧取得レスポンス DTO（ページネーション対応）
 *
 * POST /api/v1/spots/photos のレスポンス Body。
 * - ids: 撮影日時降順でマージした写真IDのページ
 * - total: フィルタ条件適用後の総件数
 */
public class SpotPhotosResponse {

    @JsonProperty("ids")
    private List<Long> ids;

    @JsonProperty("total")
    private long total;

    public SpotPhotosResponse() {}

    public SpotPhotosResponse(List<Long> ids, long total) {
        this.ids = ids;
        this.total = total;
    }

    public List<Long> getIds() {
        return ids;
    }

    public void setIds(List<Long> ids) {
        this.ids = ids;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }
}
