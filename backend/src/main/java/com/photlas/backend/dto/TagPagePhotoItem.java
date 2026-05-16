package com.photlas.backend.dto;

/**
 * Issue#136 Phase 5: キーワードランディングページのグリッド要素。
 *
 * <p>テンプレート ({@code tag-page.html}) で `photos` リストとして使う。</p>
 *
 * @param photoId      Photo.photoId
 * @param thumbnailUrl サムネイル CDN URL（{@code S3Service.generateThumbnailCdnUrl} 経由）
 */
public record TagPagePhotoItem(
        Long photoId,
        String thumbnailUrl
) {
}
