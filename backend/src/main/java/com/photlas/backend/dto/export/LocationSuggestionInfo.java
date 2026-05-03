package com.photlas.backend.dto.export;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Issue#108: 位置情報修正提案。location_suggestions.json に対応する。
 *
 * <p>本人が他者写真に対して行った提案のみ含む（§4.18）。</p>
 */
public record LocationSuggestionInfo(
        Long suggestionId,
        Long photoId,
        BigDecimal suggestedLatitude,
        BigDecimal suggestedLongitude,
        Instant createdAt
) {}
