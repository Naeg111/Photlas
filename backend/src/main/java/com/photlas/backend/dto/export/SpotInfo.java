package com.photlas.backend.dto.export;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Issue#108: 撮影スポット情報。spots.json に対応する。
 *
 * <p>本人が作成主のスポットのみ含む（§4.18）。</p>
 */
public record SpotInfo(
        Long spotId,
        BigDecimal latitude,
        BigDecimal longitude,
        Instant createdAt
) {}
