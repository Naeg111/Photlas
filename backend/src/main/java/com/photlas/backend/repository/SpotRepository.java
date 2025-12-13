package com.photlas.backend.repository;

import com.photlas.backend.entity.Spot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface SpotRepository extends JpaRepository<Spot, Long> {

    /**
     * 指定された緯度経度から半径200m以内のスポットを検索し、距離が近い順に返す
     * Haversine公式を使用して距離を計算
     *
     * 注意: H2データベースではRADIANS関数が使えないため、簡易的な計算を使用
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
     * 指定された範囲内のスポットを検索し、フィルター条件に合致する写真を集計して返す
     *
     * 戻り値: Object[] の配列で、各要素は以下の順序
     * [0] spot_id (Long)
     * [1] latitude (BigDecimal)
     * [2] longitude (BigDecimal)
     * [3] photo_count (Integer) - フィルター条件に合致する写真の枚数
     * [4] thumbnail_url (String) - 最新の写真のS3 URL
     */
    @Query(value = """
        SELECT
            s.spot_id,
            s.latitude,
            s.longitude,
            COUNT(DISTINCT p.photo_id) as photo_count,
            (
                SELECT p2.s3_object_key
                FROM photos p2
                WHERE p2.spot_id = s.spot_id
                  AND (:months IS NULL OR MONTH(p2.shot_at) IN (:months))
                  AND (:weathers IS NULL OR p2.weather IN (:weathers))
                  AND (:categories IS NULL OR EXISTS (
                      SELECT 1 FROM photo_categories pc2
                      WHERE pc2.photo_id = p2.photo_id
                        AND pc2.category_id IN (:categories)
                  ))
                ORDER BY p2.shot_at DESC
                LIMIT 1
            ) as thumbnail_url
        FROM spots s
        INNER JOIN photos p ON s.spot_id = p.spot_id
        WHERE s.latitude BETWEEN :south AND :north
          AND s.longitude BETWEEN :west AND :east
          AND (:months IS NULL OR MONTH(p.shot_at) IN (:months))
          AND (:weathers IS NULL OR p.weather IN (:weathers))
          AND (:categories IS NULL OR EXISTS (
              SELECT 1 FROM photo_categories pc
              WHERE pc.photo_id = p.photo_id
                AND pc.category_id IN (:categories)
          ))
        GROUP BY s.spot_id, s.latitude, s.longitude
        HAVING COUNT(DISTINCT p.photo_id) > 0
        ORDER BY photo_count DESC
        """, nativeQuery = true)
    List<Object[]> findSpotsWithFilters(
        @Param("north") BigDecimal north,
        @Param("south") BigDecimal south,
        @Param("east") BigDecimal east,
        @Param("west") BigDecimal west,
        @Param("categories") List<Integer> categories,
        @Param("months") List<Integer> months,
        @Param("times") List<String> times,
        @Param("weathers") List<String> weathers
    );
}
