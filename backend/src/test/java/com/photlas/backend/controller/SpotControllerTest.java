package com.photlas.backend.controller;

import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.filter.RateLimitFilter;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SpotControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private RateLimitFilter rateLimitFilter;

    private User testUser;
    private String token;
    private Category category1;
    private Category category2;

    // Test Data Constants - User
    private static final String TEST_USERNAME = "testuser";
    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_PASSWORD_HASH = "hashedpassword";
    private static final String USER_ROLE = "USER";

    // Test Data Constants - Category
    private static final String CATEGORY_NAME_1 = "風景";
    private static final String CATEGORY_NAME_2 = "都市・街並み";

    // Test Data Constants - Coordinates
    private static final BigDecimal TEST_LATITUDE = new BigDecimal("35.6585");
    private static final BigDecimal TEST_LONGITUDE = new BigDecimal("139.7454");
    private static final BigDecimal TEST_LATITUDE_2 = new BigDecimal("35.6586");
    private static final BigDecimal TEST_LONGITUDE_2 = new BigDecimal("139.7455");
    private static final BigDecimal TEST_LATITUDE_3 = new BigDecimal("35.6587");
    private static final BigDecimal TEST_LONGITUDE_3 = new BigDecimal("139.7456");

    // Test Data Constants - Bounds
    private static final String BOUND_NORTH = "35.7";
    private static final String BOUND_SOUTH = "35.6";
    private static final String BOUND_EAST = "139.8";
    private static final String BOUND_WEST = "139.7";
    private static final String BOUND_NORTH_WIDE = "36.0";
    private static final String BOUND_SOUTH_WIDE = "35.0";
    private static final String BOUND_EAST_WIDE = "140.0";
    private static final String BOUND_WEST_WIDE = "139.0";

    // Test Data Constants - Dates（期間内に収まるよう現在時刻ベースで算出）
    private static final LocalDateTime TEST_SHOT_AT = LocalDateTime.now().minusHours(1);
    private static final LocalDateTime TEST_SHOT_AT_OLD = LocalDateTime.now().minusHours(48);
    private static final LocalDateTime TEST_SHOT_AT_NEW = LocalDateTime.now().minusMinutes(30);
    private static final LocalDateTime TEST_SHOT_AT_OUTSIDE_PERIOD = LocalDateTime.now().minusHours(500);

    // Test Data Constants - Weather
    private static final String WEATHER_SUNNY = "Sunny";
    private static final String WEATHER_CLOUDY = "Cloudy";

    // Test Data Constants - Time of Day
    private static final String TIME_OF_DAY_MORNING = "MORNING";
    private static final String TIME_OF_DAY_DAY = "DAY";
    private static final String TIME_OF_DAY_EVENING = "EVENING";

    // Test Data Constants - Photo
    private static final String TEST_PHOTO_TITLE = "Test Photo";
    private static final String TEST_S3_OBJECT_KEY = "test-key";
    private static final String OLD_PHOTO_KEY = "old-photo-key";
    private static final String NEW_PHOTO_KEY = "new-photo-key";

    // Test Data Constants - Months
    private static final int MONTH_DECEMBER = 12;
    private static final int MONTH_AUGUST = 8;

    // Test Data Constants - Pin Colors
    private static final String PIN_COLOR_GREEN = "Green";
    private static final String PIN_COLOR_YELLOW = "Yellow";
    private static final String PIN_COLOR_ORANGE = "Orange";
    private static final String PIN_COLOR_RED = "Red";

    // Test Data Constants - Photo Counts
    private static final int PHOTO_COUNT_ONE = 1;
    private static final int PHOTO_COUNT_FIVE = 5;
    private static final int PHOTO_COUNT_TEN = 10;
    private static final int PHOTO_COUNT_THIRTY = 30;

    // Test Data Constants - Limits
    private static final int MAX_SPOTS_LIMIT = 50;
    private static final int TEST_SPOTS_EXCEED_LIMIT = 60;

    // Endpoint Constants
    private static final String SPOTS_ENDPOINT = "/api/v1/spots";

    // JSONPath Constants
    private static final String JSON_PATH_SPOT_ID = "$[0].spotId";
    private static final String JSON_PATH_LATITUDE = "$[0].latitude";
    private static final String JSON_PATH_LONGITUDE = "$[0].longitude";
    private static final String JSON_PATH_PIN_COLOR = "$[0].pinColor";
    private static final String JSON_PATH_THUMBNAIL_URL = "$[0].thumbnailUrl";
    private static final String JSON_PATH_PHOTO_COUNT = "$[0].photoCount";

    // Parameter Name Constants
    private static final String PARAM_NORTH = "north";
    private static final String PARAM_SOUTH = "south";
    private static final String PARAM_EAST = "east";
    private static final String PARAM_WEST = "west";
    private static final String PARAM_MONTHS = "months";
    private static final String PARAM_WEATHERS = "weathers";
    private static final String PARAM_SUBJECT_CATEGORIES = "subject_categories";
    private static final String PARAM_TIMES_OF_DAY = "times_of_day";

    @BeforeEach
    void setUp() {
        // レート制限キャッシュをクリア
        rateLimitFilter.clearCache();

        // クリーンアップ
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();

        // テストユーザーを作成
        testUser = new User();
        testUser.setUsername(TEST_USERNAME);
        testUser.setEmail(TEST_EMAIL);
        testUser.setPasswordHash(TEST_PASSWORD_HASH);
        testUser.setRole(USER_ROLE);
        testUser = userRepository.save(testUser);

        // JWTトークンを生成
        token = jwtService.generateToken(testUser.getEmail());

        // カテゴリマスターデータを作成
        category1 = new Category();
        category1.setName(CATEGORY_NAME_1);
        category1 = categoryRepository.save(category1);

        category2 = new Category();
        category2.setName(CATEGORY_NAME_2);
        category2 = categoryRepository.save(category2);
    }

    @Test
    @DisplayName("正常ケース - 範囲内のスポットを取得")
    void testGetSpots_WithinBounds_ReturnsSpots() throws Exception {
        // スポットとフォトを作成
        Spot spot = new Spot();
        spot.setLatitude(TEST_LATITUDE);
        spot.setLongitude(TEST_LONGITUDE);
        spot.setCreatedByUserId(testUser.getId());
        spot = spotRepository.save(spot);

        Photo photo = new Photo();
        photo.setTitle(TEST_PHOTO_TITLE);
        photo.setS3ObjectKey(TEST_S3_OBJECT_KEY);
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setShotAt(TEST_SHOT_AT);
        photo.setWeather(WEATHER_SUNNY);
        List<Category> categories = new ArrayList<>();
        categories.add(category1);
        photo.setCategories(categories);
        photoRepository.save(photo);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThan(0))))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot.getSpotId().intValue())))
                .andExpect(jsonPath(JSON_PATH_LATITUDE, is(TEST_LATITUDE.doubleValue())))
                .andExpect(jsonPath(JSON_PATH_LONGITUDE, is(TEST_LONGITUDE.doubleValue())))
                .andExpect(jsonPath(JSON_PATH_PIN_COLOR, notNullValue()))
                .andExpect(jsonPath(JSON_PATH_THUMBNAIL_URL, notNullValue()))
                .andExpect(jsonPath(JSON_PATH_PHOTO_COUNT, greaterThan(0)));
    }

    @Test
    @DisplayName("正常ケース - フィルター条件でスポットを取得（月指定）")
    void testGetSpots_WithMonthFilter_ReturnsFilteredSpots() throws Exception {
        // 現在月の写真
        int currentMonth = LocalDateTime.now().getMonthValue();
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);

        // 異なる月の写真（期間内だが月フィルターで除外される）
        // 現在月と異なる月を算出（現在が1月なら2月、それ以外なら1月）
        int differentMonth = currentMonth == 1 ? 2 : 1;
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        createPhoto(spot2, LocalDateTime.now().withMonth(differentMonth).minusHours(2), WEATHER_SUNNY);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_MONTHS, String.valueOf(currentMonth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("正常ケース - フィルター条件でスポットを取得（天気指定）")
    void testGetSpots_WithWeatherFilter_ReturnsFilteredSpots() throws Exception {
        // Sunny の写真
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);

        // Cloudy の写真
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        createPhoto(spot2, TEST_SHOT_AT, WEATHER_CLOUDY);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_WEATHERS, WEATHER_SUNNY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("正常ケース - フィルター条件でスポットを取得（被写体種別指定）")
    void testGetSpots_WithSubjectCategoryFilter_ReturnsFilteredSpots() throws Exception {
        // category1 の写真
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo photo1 = createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);
        List<Category> categories1 = new ArrayList<>();
        categories1.add(category1);
        photo1.setCategories(categories1);
        photoRepository.save(photo1);

        // category2 の写真
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        Photo photo2 = createPhoto(spot2, TEST_SHOT_AT, WEATHER_SUNNY);
        List<Category> categories2 = new ArrayList<>();
        categories2.add(category2);
        photo2.setCategories(categories2);
        photoRepository.save(photo2);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_SUBJECT_CATEGORIES, String.valueOf(category1.getCategoryId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("正常ケース - ピンの色が条件合致数に基づいて決定される（1件=Green）")
    void testGetSpots_PinColor_OnePhoto_ReturnsGreen() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_PIN_COLOR, is(PIN_COLOR_GREEN)));
    }

    @Test
    @DisplayName("正常ケース - ピンの色が条件合致数に基づいて決定される（5件以上=Yellow）")
    void testGetSpots_PinColor_FivePhotos_ReturnsYellow() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        for (int i = 0; i < PHOTO_COUNT_FIVE; i++) {
            createPhoto(spot, LocalDateTime.now().minusHours(i + 1), WEATHER_SUNNY);
        }

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_PIN_COLOR, is(PIN_COLOR_YELLOW)));
    }

    @Test
    @DisplayName("正常ケース - ピンの色が条件合致数に基づいて決定される（10件以上=Orange）")
    void testGetSpots_PinColor_TenPhotos_ReturnsOrange() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        for (int i = 0; i < PHOTO_COUNT_TEN; i++) {
            createPhoto(spot, LocalDateTime.now().minusHours(i + 1), WEATHER_SUNNY);
        }

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_PIN_COLOR, is(PIN_COLOR_ORANGE)));
    }

    @Test
    @DisplayName("正常ケース - ピンの色が条件合致数に基づいて決定される（30件以上=Red）")
    void testGetSpots_PinColor_ThirtyPhotos_ReturnsRed() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        for (int i = 0; i < PHOTO_COUNT_THIRTY; i++) {
            createPhoto(spot, LocalDateTime.now().minusMinutes(i + 1), WEATHER_SUNNY);
        }

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_PIN_COLOR, is(PIN_COLOR_RED)));
    }

    @Test
    @DisplayName("正常ケース - レスポンス件数制限（最大50件）")
    void testGetSpots_LimitTo50_Returns50Spots() throws Exception {
        // 60件のスポットを作成
        for (int i = 0; i < TEST_SPOTS_EXCEED_LIMIT; i++) {
            Spot spot = createSpot(
                    new BigDecimal("35.65").add(new BigDecimal("0.001").multiply(new BigDecimal(i))),
                    new BigDecimal("139.74").add(new BigDecimal("0.001").multiply(new BigDecimal(i)))
            );
            createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);
        }

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH_WIDE)
                        .param(PARAM_SOUTH, BOUND_SOUTH_WIDE)
                        .param(PARAM_EAST, BOUND_EAST_WIDE)
                        .param(PARAM_WEST, BOUND_WEST_WIDE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(MAX_SPOTS_LIMIT)));
    }

    @Test
    @DisplayName("正常ケース - 期間外の投稿はカウントされない")
    void testGetSpots_PhotoOutsidePeriod_NotCounted() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);

        // 期間外の写真（500時間前 > 336時間）
        createPhoto(spot, TEST_SHOT_AT_OUTSIDE_PERIOD, WEATHER_SUNNY);

        // 期間外のみなのでスポットが返されない
        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("正常ケース - 期間内の投稿のみがカウントされる")
    void testGetSpots_MixedPeriodPhotos_OnlyCountsWithinPeriod() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);

        // 期間内の写真1枚
        createPhoto(spot, LocalDateTime.now().minusHours(1), WEATHER_SUNNY);

        // 期間外の写真4枚
        for (int i = 0; i < 4; i++) {
            createPhoto(spot, TEST_SHOT_AT_OUTSIDE_PERIOD.minusHours(i), WEATHER_SUNNY);
        }

        // 期間内は1枚のみなのでGreen
        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_PIN_COLOR, is(PIN_COLOR_GREEN)))
                .andExpect(jsonPath(JSON_PATH_PHOTO_COUNT, is(1)));
    }

    @Test
    @DisplayName("正常ケース - 条件合致数が多い順に返される")
    void testGetSpots_OrderByPhotoCount_ReturnsOrderedSpots() throws Exception {
        // スポット1: 写真1枚
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);

        // スポット2: 写真3枚
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        for (int i = 0; i < 3; i++) {
            createPhoto(spot2, LocalDateTime.now().minusHours(i + 1), WEATHER_SUNNY);
        }

        // スポット3: 写真5枚
        Spot spot3 = createSpot(TEST_LATITUDE_3, TEST_LONGITUDE_3);
        for (int i = 0; i < PHOTO_COUNT_FIVE; i++) {
            createPhoto(spot3, LocalDateTime.now().minusHours(i + 1), WEATHER_SUNNY);
        }

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].spotId", is(spot3.getSpotId().intValue())))
                .andExpect(jsonPath("$[0].photoCount", is(PHOTO_COUNT_FIVE)))
                .andExpect(jsonPath("$[1].spotId", is(spot2.getSpotId().intValue())))
                .andExpect(jsonPath("$[1].photoCount", is(3)))
                .andExpect(jsonPath("$[2].spotId", is(spot1.getSpotId().intValue())))
                .andExpect(jsonPath("$[2].photoCount", is(PHOTO_COUNT_ONE)));
    }

    @Test
    @DisplayName("正常ケース - サムネイルURLは最新の写真から取得される")
    void testGetSpots_ThumbnailUrl_ReturnsLatestPhoto() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);

        // 古い写真
        Photo oldPhoto = createPhoto(spot, TEST_SHOT_AT_OLD, WEATHER_SUNNY);
        oldPhoto.setS3ObjectKey(OLD_PHOTO_KEY);
        photoRepository.save(oldPhoto);

        // 新しい写真
        Photo newPhoto = createPhoto(spot, TEST_SHOT_AT_NEW, WEATHER_SUNNY);
        newPhoto.setS3ObjectKey(NEW_PHOTO_KEY);
        photoRepository.save(newPhoto);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_THUMBNAIL_URL, containsString(NEW_PHOTO_KEY)));
    }

    @Test
    @DisplayName("バリデーションエラー - 範囲パラメータが不足している場合")
    void testGetSpots_MissingBoundsParams_ReturnsBadRequest() throws Exception {
        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("正常ケース - 条件に合致する写真が0件のスポットは含まれない")
    void testGetSpots_NoMatchingPhotos_ReturnsEmptyList() throws Exception {
        // 現在月の写真のみ
        int currentMonth = LocalDateTime.now().getMonthValue();
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);

        // 異なる月でフィルター（合致なし）
        int differentMonth = currentMonth == 1 ? 2 : 1;
        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_MONTHS, String.valueOf(differentMonth)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("正常ケース - フィルター条件でスポットを取得（時間帯指定）")
    void testGetSpots_WithTimeOfDayFilter_ReturnsFilteredSpots() throws Exception {
        // MORNING の写真
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo photo1 = createPhotoWithTimeOfDay(spot1, TEST_SHOT_AT, WEATHER_SUNNY, TIME_OF_DAY_MORNING);

        // EVENING の写真
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        Photo photo2 = createPhotoWithTimeOfDay(spot2, LocalDateTime.now().minusHours(2), WEATHER_SUNNY, TIME_OF_DAY_EVENING);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_TIMES_OF_DAY, TIME_OF_DAY_MORNING))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("正常ケース - フィルター条件でスポットを取得（複数の時間帯指定）")
    void testGetSpots_WithMultipleTimesOfDay_ReturnsFilteredSpots() throws Exception {
        // MORNING の写真
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhotoWithTimeOfDay(spot1, LocalDateTime.now().minusHours(3), WEATHER_SUNNY, TIME_OF_DAY_MORNING);

        // DAY の写真
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        createPhotoWithTimeOfDay(spot2, LocalDateTime.now().minusHours(2), WEATHER_SUNNY, TIME_OF_DAY_DAY);

        // EVENING の写真
        Spot spot3 = createSpot(TEST_LATITUDE_3, TEST_LONGITUDE_3);
        createPhotoWithTimeOfDay(spot3, LocalDateTime.now().minusHours(1), WEATHER_SUNNY, TIME_OF_DAY_EVENING);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_TIMES_OF_DAY, TIME_OF_DAY_MORNING, TIME_OF_DAY_EVENING))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[*].spotId", containsInAnyOrder(
                        spot1.getSpotId().intValue(),
                        spot3.getSpotId().intValue()
                )));
    }

    // ヘルパーメソッド
    private Spot createSpot(BigDecimal latitude, BigDecimal longitude) {
        Spot spot = new Spot();
        spot.setLatitude(latitude);
        spot.setLongitude(longitude);
        spot.setCreatedByUserId(testUser.getId());
        return spotRepository.save(spot);
    }

    private Photo createPhoto(Spot spot, LocalDateTime shotAt, String weather) {
        Photo photo = new Photo();
        photo.setTitle(TEST_PHOTO_TITLE);
        photo.setS3ObjectKey(TEST_S3_OBJECT_KEY + "-" + System.nanoTime());
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setShotAt(shotAt);
        photo.setWeather(weather);
        List<Category> categories = new ArrayList<>();
        categories.add(category1);
        photo.setCategories(categories);
        return photoRepository.save(photo);
    }

    private Photo createPhotoWithTimeOfDay(Spot spot, LocalDateTime shotAt, String weather, String timeOfDay) {
        Photo photo = new Photo();
        photo.setTitle(TEST_PHOTO_TITLE);
        photo.setS3ObjectKey(TEST_S3_OBJECT_KEY + "-" + System.nanoTime());
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setShotAt(shotAt);
        photo.setWeather(weather);
        photo.setTimeOfDay(timeOfDay);
        List<Category> categories = new ArrayList<>();
        categories.add(category1);
        photo.setCategories(categories);
        return photoRepository.save(photo);
    }
}
