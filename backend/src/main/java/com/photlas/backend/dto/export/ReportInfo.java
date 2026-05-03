package com.photlas.backend.dto.export;

import java.time.Instant;

/**
 * Issue#108: 通報情報。reports.json に対応する。
 *
 * <p>本人が行った通報のみ含む。reasonText は通報者本人の文章なので含める（§4.16）。</p>
 */
public record ReportInfo(
        Long reportId,
        Integer targetType,
        Long targetId,
        Integer reasonCategory,
        String reasonText,
        Instant createdAt
) {}
