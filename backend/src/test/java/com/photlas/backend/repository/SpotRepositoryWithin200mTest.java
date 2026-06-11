package com.photlas.backend.repository;

import com.photlas.backend.entity.Spot;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#149: {@link SpotRepository#findSpotsWithin200m} の結合テスト（実 PostgreSQL+PostGIS）。
 *
 * <p>半径 200m 判定と「近い順」の振る舞いを検証する。Haversine → ST_DWithin への
 * 書き換え前後で同じ結果になることを担保する安全網。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SpotRepositoryWithin200mTest {

    @Autowired
    private SpotRepository spotRepository;

    private static final BigDecimal BASE_LAT = new BigDecimal("35.681236");
    private static final BigDecimal BASE_LNG = new BigDecimal("139.767125");

    /** 緯度のみを meters 分北へずらした座標（経度同じ＝2 点間距離 ≒ meters）。 */
    private static BigDecimal latOffsetMeters(BigDecimal baseLat, double meters) {
        double metersPerDegree = 6371000.0 * Math.PI / 180.0; // 緯度 1 度あたりのメートル数（球）
        return baseLat.add(BigDecimal.valueOf(meters / metersPerDegree));
    }

    private Spot saveSpotAt(double offsetMeters) {
        Spot spot = new Spot();
        spot.setLatitude(latOffsetMeters(BASE_LAT, offsetMeters));
        spot.setLongitude(BASE_LNG);
        spot.setCreatedByUserId(1L);
        return spotRepository.saveAndFlush(spot);
    }

    @Test
    @DisplayName("Issue#149 - 半径200m以内のスポットだけが返る（200m超は返らない）")
    void returnsSpotsWithin200mOnly() {
        Spot near50 = saveSpotAt(50);
        Spot near150 = saveSpotAt(150);
        saveSpotAt(250);  // 圏外
        saveSpotAt(400);  // 圏外

        List<Spot> result = spotRepository.findSpotsWithin200m(BASE_LAT, BASE_LNG);

        assertThat(result).extracting(Spot::getSpotId)
                .containsExactlyInAnyOrder(near50.getSpotId(), near150.getSpotId());
    }

    @Test
    @DisplayName("Issue#149 - 結果は近い順（最近傍が先頭）で返る")
    void returnsSpotsOrderedByDistance() {
        Spot s150 = saveSpotAt(150);
        Spot s50 = saveSpotAt(50);
        Spot s100 = saveSpotAt(100);

        List<Spot> result = spotRepository.findSpotsWithin200m(BASE_LAT, BASE_LNG);

        assertThat(result).extracting(Spot::getSpotId)
                .containsExactly(s50.getSpotId(), s100.getSpotId(), s150.getSpotId());
    }

    @Test
    @DisplayName("Issue#149 - 圏内に何も無ければ空リスト")
    void returnsEmptyWhenNoneWithin200m() {
        saveSpotAt(500);

        List<Spot> result = spotRepository.findSpotsWithin200m(BASE_LAT, BASE_LNG);

        assertThat(result).isEmpty();
    }
}
