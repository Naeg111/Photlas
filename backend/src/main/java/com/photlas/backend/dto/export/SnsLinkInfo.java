package com.photlas.backend.dto.export;

import java.time.Instant;

/**
 * Issue#108: SNS リンク情報。sns_links.json に対応する。
 */
public record SnsLinkInfo(Integer platform, String url, Instant createdAt) {}
