package com.photlas.backend.dto.export;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Spec#108: 写真メタデータ。photos.json に対応する。
 *
 * <p>spotId、cropCenter*、s3ObjectKey は含めない（内部実装情報のため）。
 * s3ObjectKey は ZIP 内のファイルパス決定にのみ使用するため、別途
 * UserDataCollectorService の内部から参照される。</p>
 *
 * <p>REMOVED ステータスの写真は file = null として返される（画像ファイル本体は
 * ZIP に同梱されない、§4.8 参照）。</p>
 *
 * <p>Spec#161 §3.6: {@code shotAt} は UTC に直さず、{@code shot_at} の時刻（カメラの時計の時刻）を
 * そのまま出す。どこの時刻か分からないため、末尾 {@code Z} もオフセットも付けない。秒が 0 でも省かない
 * （例: {@code 2026-11-11T14:30:00}）。Spec#108 §4.13「日時は UTC」の例外。</p>
 */
public record PhotoInfo(
        Long photoId,
        String file,
        String s3ObjectKey,
        Integer moderationStatus,
        String placeName,
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
        LocalDateTime shotAt,
        BigDecimal latitude,
        BigDecimal longitude,
        Integer weather,
        Integer timeOfDay,
        Integer deviceType,
        List<CategoryInfo> categories,
        String cameraBody,
        String cameraLens,
        Integer focalLength35mm,
        String fValue,
        String shutterSpeed,
        Integer iso,
        Integer imageWidth,
        Integer imageHeight,
        Instant createdAt
) {}
