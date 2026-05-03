package com.photlas.backend.dto.export;

import java.time.Instant;

/**
 * Issue#108: 違反履歴。violations.json に対応する。
 *
 * <p>管理者が記入した自由記述は含めない（§4.17）。</p>
 */
public record ViolationInfo(
        Integer targetType,
        Long targetId,
        Integer violationType,
        Integer actionTaken,
        Instant createdAt
) {}
