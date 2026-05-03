package com.photlas.backend.dto.export;

import java.time.Instant;

/**
 * Issue#108: お気に入り情報。favorites.json に対応する。
 */
public record FavoriteInfo(Long photoId, Instant createdAt) {}
