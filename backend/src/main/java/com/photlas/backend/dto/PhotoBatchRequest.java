package com.photlas.backend.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Issue#122: 写真詳細バッチ取得リクエスト DTO
 *
 * 複数の photoId を受け取って、まとめて写真詳細を返すエンドポイント用のリクエスト。
 * 写真詳細ダイアログの prefetch を 1 リクエストに集約するために使用する。
 */
public class PhotoBatchRequest {

    /** バッチサイズ上限（悪用防止）。prefetch 用途では radius=2 で最大 4 件なので余裕あり。 */
    public static final int MAX_BATCH_SIZE = 20;

    @NotNull(message = "photoIds は必須です")
    @NotEmpty(message = "photoIds は 1 件以上指定してください")
    @Size(max = MAX_BATCH_SIZE, message = "photoIds は最大 {max} 件までです")
    private List<Long> photoIds;

    public List<Long> getPhotoIds() {
        return photoIds;
    }

    public void setPhotoIds(List<Long> photoIds) {
        this.photoIds = photoIds;
    }
}
