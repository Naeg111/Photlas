package com.photlas.backend.repository;

import com.photlas.backend.entity.Spot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * スポットリポジトリ
 * 撮影スポット情報のデータアクセスを提供します。
 */
@Repository
public interface SpotRepository extends JpaRepository<Spot, Long> {

    /**
     * 指定された緯度経度から半径200m以内のスポットを検索し、距離が近い順に返す
     *
     * Haversine公式を使用して2点間の距離を計算します:
     * - 地球の半径: 6371000m (平均半径)
     * - 円周率: 3.14159265358979323846 (π)
     * - 検索範囲: 200m
     *
     * @param latitude 緯度
     * @param longitude 経度
     * @return 距離が近い順のスポットリスト
     */
    @Query(value = """
        SELECT s.* FROM spots s
        WHERE (
            6371000 * 2 * ASIN(SQRT(
                POWER(SIN(((:latitude - s.latitude) * 3.14159265358979323846 / 180) / 2), 2) +
                COS(:latitude * 3.14159265358979323846 / 180) * COS(s.latitude * 3.14159265358979323846 / 180) *
                POWER(SIN(((:longitude - s.longitude) * 3.14159265358979323846 / 180) / 2), 2)
            ))
        ) <= 200
        ORDER BY (
            6371000 * 2 * ASIN(SQRT(
                POWER(SIN(((:latitude - s.latitude) * 3.14159265358979323846 / 180) / 2), 2) +
                COS(:latitude * 3.14159265358979323846 / 180) * COS(s.latitude * 3.14159265358979323846 / 180) *
                POWER(SIN(((:longitude - s.longitude) * 3.14159265358979323846 / 180) / 2), 2)
            ))
        )
        """, nativeQuery = true)
    List<Spot> findSpotsWithin200m(
        @Param("latitude") BigDecimal latitude,
        @Param("longitude") BigDecimal longitude
    );

    /**
     * Issue#72: 指定ユーザーが作成者であるスポットを検索
     */
    List<Spot> findByCreatedByUserId(Long createdByUserId);

    /**
     * Issue#72: 写真が0件の孤立スポットを削除
     */
    @org.springframework.data.jpa.repository.Modifying
    @Query("DELETE FROM Spot s WHERE s.spotId NOT IN (SELECT DISTINCT p.spotId FROM Photo p)")
    void deleteOrphanedSpots();

    /**
     * 指定された範囲内のスポットを検索し、フィルター条件に合致する写真を集計して返す
     *
     * 戻り値: Object[] の配列で、各要素は以下の順序
     * [0] spot_id (Long)
     * [1] latitude (BigDecimal)
     * [2] longitude (BigDecimal)
     * [3] photo_count (Integer) - ピン色判定用（フィルター条件に合致する写真枚数）
     * [4] total_photo_count (Integer) - 表示用（フィルター条件に合致する写真枚数）
     * [5] thumbnail_url (String) - 最新の写真のS3 URL
     */
    @Query(value = """
        SELECT
            s.spot_id,
            s.latitude,
            s.longitude,
            COUNT(DISTINCT p.photo_id) as photo_count,
            COUNT(DISTINCT p.photo_id) as total_photo_count,
            (
                SELECT p2.s3_object_key
                FROM photos p2
                INNER JOIN users u2 ON p2.user_id = u2.id
                WHERE p2.spot_id = s.spot_id
                  AND p2.moderation_status = 'PUBLISHED'
                  AND u2.deleted_at IS NULL
                  AND (-1 IN (:months) OR EXTRACT(MONTH FROM p2.shot_at) IN (:months))
                  AND ('__NONE__' IN (:timesOfDay) OR p2.time_of_day IN (:timesOfDay))
                  AND ('__NONE__' IN (:weathers) OR p2.weather IN (:weathers))
                  AND (-1 IN (:subjectCategories) OR EXISTS (
                      SELECT 1 FROM photo_categories pc2
                      WHERE pc2.photo_id = p2.photo_id
                        AND pc2.category_id IN (:subjectCategories)
                  ))
                ORDER BY p2.shot_at DESC
                LIMIT 1
            ) as thumbnail_url
        FROM spots s
        INNER JOIN photos p ON s.spot_id = p.spot_id
        INNER JOIN users u ON p.user_id = u.id
        WHERE s.latitude BETWEEN :south AND :north
          AND s.longitude BETWEEN :west AND :east
          AND p.moderation_status = 'PUBLISHED'
          AND u.deleted_at IS NULL
          AND (-1 IN (:months) OR EXTRACT(MONTH FROM p.shot_at) IN (:months))
          AND ('__NONE__' IN (:timesOfDay) OR p.time_of_day IN (:timesOfDay))
          AND ('__NONE__' IN (:weathers) OR p.weather IN (:weathers))
          AND (-1 IN (:subjectCategories) OR EXISTS (
              SELECT 1 FROM photo_categories pc
              WHERE pc.photo_id = p.photo_id
                AND pc.category_id IN (:subjectCategories)
          ))
        GROUP BY s.spot_id, s.latitude, s.longitude
        HAVING COUNT(DISTINCT p.photo_id) > 0
        ORDER BY total_photo_count DESC
        """, nativeQuery = true)
    List<Object[]> findSpotsWithFilters(
        @Param("north") BigDecimal north,
        @Param("south") BigDecimal south,
        @Param("east") BigDecimal east,
        @Param("west") BigDecimal west,
        @Param("subjectCategories") List<Integer> subjectCategories,
        @Param("months") List<Integer> months,
        @Param("timesOfDay") List<String> timesOfDay,
        @Param("weathers") List<String> weathers
    );

    /**
     * Issue#46: 詳細フィルター対応版スポット検索
     *
     * 基本フィルターに加え、以下の詳細フィルターに対応:
     * - 解像度（最小長辺px）
     * - 機材種別（SLR/MIRRORLESS/COMPACT/SMARTPHONE/FILM/OTHER）- photos.device_typeカラムで判定
     * - 鮮度（撮影日からの年数）
     * - アスペクト比（横/縦/正方形）
     * - 焦点距離帯（広角/標準/望遠/超望遠）
     * - ISO感度（最大値）
     */
    @Query(value = """
        SELECT
            s.spot_id,
            s.latitude,
            s.longitude,
            COUNT(DISTINCT p.photo_id) as photo_count,
            COUNT(DISTINCT p.photo_id) as total_photo_count,
            (
                SELECT p2.s3_object_key
                FROM photos p2
                INNER JOIN users u2 ON p2.user_id = u2.id
                WHERE p2.spot_id = s.spot_id
                  AND p2.moderation_status = 'PUBLISHED'
                  AND u2.deleted_at IS NULL
                  AND (-1 IN (:months) OR EXTRACT(MONTH FROM p2.shot_at) IN (:months))
                  AND ('__NONE__' IN (:timesOfDay) OR p2.time_of_day IN (:timesOfDay))
                  AND ('__NONE__' IN (:weathers) OR p2.weather IN (:weathers))
                  AND (-1 IN (:subjectCategories) OR EXISTS (
                      SELECT 1 FROM photo_categories pc2
                      WHERE pc2.photo_id = p2.photo_id
                        AND pc2.category_id IN (:subjectCategories)
                  ))
                  AND (:minResolution = -1 OR (p2.image_width IS NOT NULL AND p2.image_height IS NOT NULL AND GREATEST(p2.image_width, p2.image_height) >= :minResolution))
                  AND ('__NONE__' IN (:deviceTypes) OR p2.device_type IN (:deviceTypes))
                  AND (:hasMaxAge = false OR p2.shot_at >= :maxAgeDate)
                  AND ('__NONE__' IN (:aspectRatios)
                       OR ('HORIZONTAL' IN (:aspectRatios) AND p2.image_width IS NOT NULL AND p2.image_height IS NOT NULL AND p2.image_width > p2.image_height)
                       OR ('VERTICAL' IN (:aspectRatios) AND p2.image_width IS NOT NULL AND p2.image_height IS NOT NULL AND p2.image_width < p2.image_height)
                       OR ('SQUARE' IN (:aspectRatios) AND p2.image_width IS NOT NULL AND p2.image_height IS NOT NULL AND ABS(p2.image_width - p2.image_height) <= GREATEST(p2.image_width, p2.image_height) * 0.05)
                  )
                  AND ('__NONE__' IN (:focalLengthRanges)
                       OR ('WIDE' IN (:focalLengthRanges) AND p2.focal_length_35mm IS NOT NULL AND p2.focal_length_35mm < 24)
                       OR ('STANDARD' IN (:focalLengthRanges) AND p2.focal_length_35mm IS NOT NULL AND p2.focal_length_35mm >= 24 AND p2.focal_length_35mm <= 70)
                       OR ('TELEPHOTO' IN (:focalLengthRanges) AND p2.focal_length_35mm IS NOT NULL AND p2.focal_length_35mm > 70 AND p2.focal_length_35mm <= 300)
                       OR ('SUPER_TELEPHOTO' IN (:focalLengthRanges) AND p2.focal_length_35mm IS NOT NULL AND p2.focal_length_35mm > 300)
                  )
                  AND (:maxIso = -1 OR (p2.iso IS NOT NULL AND p2.iso <= :maxIso))
                ORDER BY p2.shot_at DESC
                LIMIT 1
            ) as thumbnail_url
        FROM spots s
        INNER JOIN photos p ON s.spot_id = p.spot_id
        INNER JOIN users u ON p.user_id = u.id
        WHERE s.latitude BETWEEN :south AND :north
          AND s.longitude BETWEEN :west AND :east
          AND p.moderation_status = 'PUBLISHED'
          AND u.deleted_at IS NULL
          AND (-1 IN (:months) OR EXTRACT(MONTH FROM p.shot_at) IN (:months))
          AND ('__NONE__' IN (:timesOfDay) OR p.time_of_day IN (:timesOfDay))
          AND ('__NONE__' IN (:weathers) OR p.weather IN (:weathers))
          AND (-1 IN (:subjectCategories) OR EXISTS (
              SELECT 1 FROM photo_categories pc
              WHERE pc.photo_id = p.photo_id
                AND pc.category_id IN (:subjectCategories)
          ))
          AND (:minResolution = -1 OR (p.image_width IS NOT NULL AND p.image_height IS NOT NULL AND GREATEST(p.image_width, p.image_height) >= :minResolution))
          AND ('__NONE__' IN (:deviceTypes) OR p.device_type IN (:deviceTypes))
          AND (:hasMaxAge = false OR p.shot_at >= :maxAgeDate)
          AND ('__NONE__' IN (:aspectRatios)
               OR ('HORIZONTAL' IN (:aspectRatios) AND p.image_width IS NOT NULL AND p.image_height IS NOT NULL AND p.image_width > p.image_height)
               OR ('VERTICAL' IN (:aspectRatios) AND p.image_width IS NOT NULL AND p.image_height IS NOT NULL AND p.image_width < p.image_height)
               OR ('SQUARE' IN (:aspectRatios) AND p.image_width IS NOT NULL AND p.image_height IS NOT NULL AND ABS(p.image_width - p.image_height) <= GREATEST(p.image_width, p.image_height) * 0.05)
          )
          AND ('__NONE__' IN (:focalLengthRanges)
               OR ('WIDE' IN (:focalLengthRanges) AND p.focal_length_35mm IS NOT NULL AND p.focal_length_35mm < 24)
               OR ('STANDARD' IN (:focalLengthRanges) AND p.focal_length_35mm IS NOT NULL AND p.focal_length_35mm >= 24 AND p.focal_length_35mm <= 70)
               OR ('TELEPHOTO' IN (:focalLengthRanges) AND p.focal_length_35mm IS NOT NULL AND p.focal_length_35mm > 70 AND p.focal_length_35mm <= 300)
               OR ('SUPER_TELEPHOTO' IN (:focalLengthRanges) AND p.focal_length_35mm IS NOT NULL AND p.focal_length_35mm > 300)
          )
          AND (:maxIso = -1 OR (p.iso IS NOT NULL AND p.iso <= :maxIso))
        GROUP BY s.spot_id, s.latitude, s.longitude
        HAVING COUNT(DISTINCT p.photo_id) > 0
        ORDER BY total_photo_count DESC
        """, nativeQuery = true)
    List<Object[]> findSpotsWithAdvancedFilters(
        @Param("north") BigDecimal north,
        @Param("south") BigDecimal south,
        @Param("east") BigDecimal east,
        @Param("west") BigDecimal west,
        @Param("subjectCategories") List<Integer> subjectCategories,
        @Param("months") List<Integer> months,
        @Param("timesOfDay") List<String> timesOfDay,
        @Param("weathers") List<String> weathers,
        @Param("minResolution") int minResolution,
        @Param("deviceTypes") List<String> deviceTypes,
        @Param("hasMaxAge") boolean hasMaxAge,
        @Param("maxAgeDate") LocalDateTime maxAgeDate,
        @Param("aspectRatios") List<String> aspectRatios,
        @Param("focalLengthRanges") List<String> focalLengthRanges,
        @Param("maxIso") int maxIso
    );
}
