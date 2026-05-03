package com.photlas.backend.dto.export;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Issue#108: 写真メタデータ。photos.json に対応する。
 *
 * <p>spotId、cropCenter*、s3ObjectKey は含めない（内部実装情報のため）。
 * s3ObjectKey は ZIP 内のファイルパス決定にのみ使用するため、別途
 * UserDataCollectorService の内部から参照される。</p>
 *
 * <p>REMOVED ステータスの写真は file = null として返される（画像ファイル本体は
 * ZIP に同梱されない、§4.8 参照）。</p>
 */
public record PhotoInfo(
        Long photoId,
        String file,
        String s3ObjectKey,
        Integer moderationStatus,
        String placeName,
        Instant shotAt,
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
