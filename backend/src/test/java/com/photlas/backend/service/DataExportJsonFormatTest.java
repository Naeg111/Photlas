package com.photlas.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.export.PhotoInfo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Spec#161 §3.6 - photos.json の shotAt の書式のテスト（DB 不要）。
 *
 * 要件:
 *   - shotAt は UTC に直さず、shot_at の時刻をそのまま出す（末尾 Z もオフセットも付けない）
 *   - 秒が 0 でも省かない（yyyy-MM-dd'T'HH:mm:ss）
 *   - createdAt など、サーバーが記録した時刻は今どおり UTC（末尾 Z）で出す（Spec#108 §4.13）
 */
class DataExportJsonFormatTest {

    private final ObjectMapper mapper = DataExportService.buildObjectMapper();

    @Test
    @DisplayName("Spec#161 - shotAt は Z なし・秒ありで、shot_at の時刻をそのまま出力する")
    void shotAtIsWrittenAsLocalDateTimeWithSeconds() throws Exception {
        PhotoInfo photo = photoInfo(LocalDateTime.of(2026, 11, 11, 14, 30, 0),
                Instant.parse("2026-11-11T05:40:00Z"));

        JsonNode json = mapper.readTree(mapper.writeValueAsString(photo));

        assertThat(json.get("shotAt").asText()).isEqualTo("2026-11-11T14:30:00");
    }

    @Test
    @DisplayName("Spec#161 - 秒が 0 以外でもそのまま出力する")
    void shotAtKeepsNonZeroSeconds() throws Exception {
        PhotoInfo photo = photoInfo(LocalDateTime.of(2026, 1, 2, 3, 4, 5), null);

        JsonNode json = mapper.readTree(mapper.writeValueAsString(photo));

        assertThat(json.get("shotAt").asText()).isEqualTo("2026-01-02T03:04:05");
    }

    @Test
    @DisplayName("Spec#108 - createdAt は今どおり UTC（末尾 Z）で出力する")
    void createdAtIsStillWrittenAsUtcInstant() throws Exception {
        PhotoInfo photo = photoInfo(LocalDateTime.of(2026, 11, 11, 14, 30, 0),
                Instant.parse("2026-11-11T05:40:00Z"));

        JsonNode json = mapper.readTree(mapper.writeValueAsString(photo));

        assertThat(json.get("createdAt").asText()).isEqualTo("2026-11-11T05:40:00Z");
    }

    @Test
    @DisplayName("Spec#161 - shotAt が null なら null を出力する")
    void nullShotAtIsWrittenAsNull() throws Exception {
        PhotoInfo photo = photoInfo(null, Instant.parse("2026-11-11T05:40:00Z"));

        JsonNode json = mapper.readTree(mapper.writeValueAsString(photo));

        assertThat(json.get("shotAt").isNull()).isTrue();
    }

    private static PhotoInfo photoInfo(LocalDateTime shotAt, Instant createdAt) {
        return new PhotoInfo(
                1L, "1.jpg", "uploads/1/a.jpg", 1001, "東京タワー",
                shotAt,
                null, null, null, null, null,
                List.of(),
                null, null, null, null, null, null, null, null,
                createdAt);
    }
}
