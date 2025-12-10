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
}
