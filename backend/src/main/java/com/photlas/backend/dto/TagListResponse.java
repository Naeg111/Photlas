package com.photlas.backend.dto;

import java.util.List;

/**
 * Spec#135: {@code GET /api/v1/tags} のレスポンス DTO。
 *
 * @param tags 全 is_active=TRUE のタグ
 */
public record TagListResponse(List<TagListItem> tags) {
}
