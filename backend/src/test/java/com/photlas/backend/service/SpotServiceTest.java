package com.photlas.backend.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#103: ピン色閾値の変更 + Purple 追加
 *
 * 新しい閾値:
 * - 1〜9: Green
 * - 10〜49: Yellow
 * - 50〜99: Orange
 * - 100〜999: Red
 * - 1,000以上: Purple
 */
@SpringBootTest
@ActiveProfiles("test")
class SpotServiceTest {

    @Autowired
    private SpotService spotService;

    @Test
    @DisplayName("Issue#103 - 1,000件で Purple を返す")
    void testDeterminePinColor_1000_ReturnsPurple() {
        assertThat(spotService.determinePinColor(1000)).isEqualTo("Purple");
    }

    @Test
    @DisplayName("Issue#103 - 999件で Red を返す（Red/Purple 境界値）")
    void testDeterminePinColor_999_ReturnsRed() {
        assertThat(spotService.determinePinColor(999)).isEqualTo("Red");
    }

    @Test
    @DisplayName("Issue#103 - 100件で Red を返す")
    void testDeterminePinColor_100_ReturnsRed() {
        assertThat(spotService.determinePinColor(100)).isEqualTo("Red");
    }

    @Test
    @DisplayName("Issue#103 - 99件で Orange を返す（Orange/Red 境界値）")
    void testDeterminePinColor_99_ReturnsOrange() {
        assertThat(spotService.determinePinColor(99)).isEqualTo("Orange");
    }

    @Test
    @DisplayName("Issue#103 - 50件で Orange を返す")
    void testDeterminePinColor_50_ReturnsOrange() {
        assertThat(spotService.determinePinColor(50)).isEqualTo("Orange");
    }

    @Test
    @DisplayName("Issue#103 - 49件で Yellow を返す（Yellow/Orange 境界値）")
    void testDeterminePinColor_49_ReturnsYellow() {
        assertThat(spotService.determinePinColor(49)).isEqualTo("Yellow");
    }

    @Test
    @DisplayName("Issue#103 - 10件で Yellow を返す")
    void testDeterminePinColor_10_ReturnsYellow() {
        assertThat(spotService.determinePinColor(10)).isEqualTo("Yellow");
    }

    @Test
    @DisplayName("Issue#103 - 9件で Green を返す（Green/Yellow 境界値）")
    void testDeterminePinColor_9_ReturnsGreen() {
        assertThat(spotService.determinePinColor(9)).isEqualTo("Green");
    }

    @Test
    @DisplayName("Issue#103 - 1件で Green を返す")
    void testDeterminePinColor_1_ReturnsGreen() {
        assertThat(spotService.determinePinColor(1)).isEqualTo("Green");
    }
}
