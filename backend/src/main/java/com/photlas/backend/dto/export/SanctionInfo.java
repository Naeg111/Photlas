package com.photlas.backend.dto.export;

import java.time.Instant;

/**
 * Issue#108: アカウント制裁履歴。sanctions.json に対応する。
 *
 * <p>管理者が記入した自由記述 reason は含めない（§4.17）。</p>
 */
public record SanctionInfo(Integer sanctionType, Instant suspendedUntil, Instant createdAt) {}
