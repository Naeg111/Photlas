package com.photlas.backend.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.*;

import static org.assertj.core.api.Assertions.*;

/**
 * Issue#87: CodeConstants 数値コード定数のテスト
 */
class CodeConstantsTest {

    @Nested
    @DisplayName("番号帯の整合性")
    class CodeRangeConsistency {

        @Test
        @DisplayName("全定数値が番号帯内に収まっている")
        void allConstantsAreWithinExpectedRanges() {
            // 100番台: role
            assertThat(CodeConstants.ROLE_USER).isBetween(100, 199);
            assertThat(CodeConstants.ROLE_ADMIN).isBetween(100, 199);
            assertThat(CodeConstants.ROLE_SUSPENDED).isBetween(100, 199);

            // 200番台: category
            assertThat(CodeConstants.CATEGORY_NATURE).isBetween(200, 299);
            assertThat(CodeConstants.CATEGORY_OTHER).isBetween(200, 299);

            // 300番台: time_of_day
            assertThat(CodeConstants.TIME_OF_DAY_MORNING).isBetween(300, 399);
            assertThat(CodeConstants.TIME_OF_DAY_NIGHT).isBetween(300, 399);

            // 400番台: weather
            assertThat(CodeConstants.WEATHER_SUNNY).isBetween(400, 499);
            assertThat(CodeConstants.WEATHER_SNOW).isBetween(400, 499);

            // 500番台: device_type
            assertThat(CodeConstants.DEVICE_TYPE_SLR).isBetween(500, 599);
            assertThat(CodeConstants.DEVICE_TYPE_OTHER).isBetween(500, 599);

            // 600番台: platform
            assertThat(CodeConstants.PLATFORM_TWITTER).isBetween(600, 699);
            assertThat(CodeConstants.PLATFORM_TIKTOK).isBetween(600, 699);

            // 700番台: sanction_type
            assertThat(CodeConstants.SANCTION_WARNING).isBetween(700, 799);
            assertThat(CodeConstants.SANCTION_PERMANENT_SUSPENSION).isBetween(700, 799);

            // 800番台: report reason / violation_type
            assertThat(CodeConstants.REASON_ADULT_CONTENT).isBetween(800, 899);
            assertThat(CodeConstants.REASON_OTHER).isBetween(800, 899);

            // 900番台: moderation source
            assertThat(CodeConstants.MODERATION_SOURCE_AI_SCAN).isBetween(900, 999);

            // 1000番台: moderation_status
            assertThat(CodeConstants.MODERATION_STATUS_PENDING_REVIEW).isBetween(1000, 1099);
            assertThat(CodeConstants.MODERATION_STATUS_REMOVED).isBetween(1000, 1099);

            // 1100番台: target_type
            assertThat(CodeConstants.TARGET_TYPE_PHOTO).isBetween(1100, 1199);
            assertThat(CodeConstants.TARGET_TYPE_PROFILE).isBetween(1100, 1199);

            // 1200番台: suggestion status
            assertThat(CodeConstants.SUGGESTION_STATUS_PENDING).isBetween(1200, 1299);
            assertThat(CodeConstants.SUGGESTION_STATUS_REJECTED).isBetween(1200, 1299);

            // 1300番台: action_taken
            assertThat(CodeConstants.ACTION_TAKEN_REMOVED).isBetween(1300, 1399);
        }

        @Test
        @DisplayName("全定数値に重複がない")
        void allConstantValuesAreUnique() throws IllegalAccessException {
            Map<Integer, String> seenValues = new HashMap<>();

            for (Field field : CodeConstants.class.getDeclaredFields()) {
                if (Modifier.isStatic(field.getModifiers())
                        && Modifier.isFinal(field.getModifiers())
                        && field.getType() == int.class) {
                    int value = field.getInt(null);
                    String existingField = seenValues.put(value, field.getName());
                    assertThat(existingField)
                            .as("値 %d が %s と %s で重複", value, existingField, field.getName())
                            .isNull();
                }
            }
        }
    }

    @Nested
    @DisplayName("具体的な値の検証")
    class SpecificValues {

        @Test
        @DisplayName("User.role の値が正しい")
        void roleValues() {
            assertThat(CodeConstants.ROLE_USER).isEqualTo(101);
            assertThat(CodeConstants.ROLE_ADMIN).isEqualTo(102);
            assertThat(CodeConstants.ROLE_SUSPENDED).isEqualTo(103);
        }

        @Test
        @DisplayName("Category.id の値が正しい（14カテゴリ）")
        void categoryValues() {
            assertThat(CodeConstants.CATEGORY_NATURE).isEqualTo(201);
            assertThat(CodeConstants.CATEGORY_CITYSCAPE).isEqualTo(202);
            assertThat(CodeConstants.CATEGORY_ARCHITECTURE).isEqualTo(203);
            assertThat(CodeConstants.CATEGORY_NIGHT_VIEW).isEqualTo(204);
            assertThat(CodeConstants.CATEGORY_GOURMET).isEqualTo(205);
            assertThat(CodeConstants.CATEGORY_PLANTS).isEqualTo(206);
            assertThat(CodeConstants.CATEGORY_ANIMALS).isEqualTo(207);
            assertThat(CodeConstants.CATEGORY_WILD_BIRDS).isEqualTo(208);
            assertThat(CodeConstants.CATEGORY_CARS).isEqualTo(209);
            assertThat(CodeConstants.CATEGORY_MOTORCYCLES).isEqualTo(210);
            assertThat(CodeConstants.CATEGORY_RAILWAYS).isEqualTo(211);
            assertThat(CodeConstants.CATEGORY_AIRCRAFT).isEqualTo(212);
            assertThat(CodeConstants.CATEGORY_STARRY_SKY).isEqualTo(213);
            assertThat(CodeConstants.CATEGORY_OTHER).isEqualTo(214);
        }

        @Test
        @DisplayName("Photo.weather の値が正しい")
        void weatherValues() {
            assertThat(CodeConstants.WEATHER_SUNNY).isEqualTo(401);
            assertThat(CodeConstants.WEATHER_CLOUDY).isEqualTo(402);
            assertThat(CodeConstants.WEATHER_RAIN).isEqualTo(403);
            assertThat(CodeConstants.WEATHER_SNOW).isEqualTo(404);
        }

        @Test
        @DisplayName("Photo.moderation_status の値が正しい")
        void moderationStatusValues() {
            assertThat(CodeConstants.MODERATION_STATUS_PENDING_REVIEW).isEqualTo(1001);
            assertThat(CodeConstants.MODERATION_STATUS_PUBLISHED).isEqualTo(1002);
            assertThat(CodeConstants.MODERATION_STATUS_QUARANTINED).isEqualTo(1003);
            assertThat(CodeConstants.MODERATION_STATUS_REMOVED).isEqualTo(1004);
        }
    }

    @Nested
    @DisplayName("JWT role変換")
    class JwtRoleConversion {

        @Test
        @DisplayName("数値コード → JWT文字列の変換が正しい")
        void roleToJwtString() {
            assertThat(CodeConstants.roleToJwtString(CodeConstants.ROLE_USER)).isEqualTo("USER");
            assertThat(CodeConstants.roleToJwtString(CodeConstants.ROLE_ADMIN)).isEqualTo("ADMIN");
            assertThat(CodeConstants.roleToJwtString(CodeConstants.ROLE_SUSPENDED)).isEqualTo("SUSPENDED");
        }

        @Test
        @DisplayName("JWT文字列 → 数値コードの変換が正しい")
        void jwtStringToRole() {
            assertThat(CodeConstants.jwtStringToRole("USER")).isEqualTo(CodeConstants.ROLE_USER);
            assertThat(CodeConstants.jwtStringToRole("ADMIN")).isEqualTo(CodeConstants.ROLE_ADMIN);
            assertThat(CodeConstants.jwtStringToRole("SUSPENDED")).isEqualTo(CodeConstants.ROLE_SUSPENDED);
        }

        @Test
        @DisplayName("不明なロールコードで例外が発生する")
        void invalidRoleCodeThrowsException() {
            assertThatThrownBy(() -> CodeConstants.roleToJwtString(999))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("不明なロールコード");
        }

        @Test
        @DisplayName("不明なロール文字列で例外が発生する")
        void invalidRoleStringThrowsException() {
            assertThatThrownBy(() -> CodeConstants.jwtStringToRole("UNKNOWN"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("不明なロール文字列");
        }
    }

    @Nested
    @DisplayName("Photo Entityが数値コードを使用する（Red段階: 現在はString型のため失敗する）")
    class PhotoEntityNumericCodes {

        @Test
        @DisplayName("Photo.weatherがInteger型である")
        void photoWeatherIsInteger() throws NoSuchMethodException {
            var getter = Photo.class.getMethod("getWeather");
            assertThat(getter.getReturnType()).isEqualTo(Integer.class);
        }

        @Test
        @DisplayName("Photo.timeOfDayがInteger型である")
        void photoTimeOfDayIsInteger() throws NoSuchMethodException {
            var getter = Photo.class.getMethod("getTimeOfDay");
            assertThat(getter.getReturnType()).isEqualTo(Integer.class);
        }

        @Test
        @DisplayName("Photo.deviceTypeがInteger型である")
        void photoDeviceTypeIsInteger() throws NoSuchMethodException {
            var getter = Photo.class.getMethod("getDeviceType");
            assertThat(getter.getReturnType()).isEqualTo(Integer.class);
        }

        @Test
        @DisplayName("Photo.moderationStatusがInteger型である")
        void photoModerationStatusIsInteger() throws NoSuchMethodException {
            var getter = Photo.class.getMethod("getModerationStatus");
            assertThat(getter.getReturnType()).isEqualTo(Integer.class);
        }
    }

    @Nested
    @DisplayName("User Entityが数値コードを使用する（Red段階: 現在はString型のため失敗する）")
    class UserEntityNumericCodes {

        @Test
        @DisplayName("User.roleがInteger型である")
        void userRoleIsInteger() throws NoSuchMethodException {
            var getter = User.class.getMethod("getRole");
            assertThat(getter.getReturnType()).isEqualTo(Integer.class);
        }
    }
}
