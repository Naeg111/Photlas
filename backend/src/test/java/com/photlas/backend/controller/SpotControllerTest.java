package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
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
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
    private static final int WEATHER_SUNNY = CodeConstants.WEATHER_SUNNY;
    private static final int WEATHER_CLOUDY = CodeConstants.WEATHER_CLOUDY;

    // Test Data Constants - Time of Day
    private static final int TIME_OF_DAY_MORNING = CodeConstants.TIME_OF_DAY_MORNING;
    private static final int TIME_OF_DAY_DAY = CodeConstants.TIME_OF_DAY_DAY;
    private static final int TIME_OF_DAY_EVENING = CodeConstants.TIME_OF_DAY_EVENING;

    // Test Data Constants - Photo
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

    // Test Data Constants - Photo Counts (Issue#103: 新閾値)
    private static final int PHOTO_COUNT_ONE = 1;
    private static final int PHOTO_COUNT_FIVE = 5;
    private static final int PHOTO_COUNT_TEN = 10;
    private static final int PHOTO_COUNT_FIFTY = 50;
    private static final int PHOTO_COUNT_HUNDRED = 100;

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
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser = userRepository.save(testUser);

        // JWTトークンを生成
        token = jwtService.generateToken(testUser.getEmail());

        // カテゴリマスターデータを作成
        category1 = new Category();
        category1.setCategoryId(CodeConstants.CATEGORY_NATURE);
        category1.setName(CATEGORY_NAME_1);
        category1 = categoryRepository.save(category1);

        category2 = new Category();
        category2.setCategoryId(CodeConstants.CATEGORY_CITYSCAPE);
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
        photo.setS3ObjectKey(TEST_S3_OBJECT_KEY);
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setShotAt(TEST_SHOT_AT);
        photo.setWeather(WEATHER_SUNNY);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
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
        // TEST_SHOT_ATの月でフィルター（月末境界でnow()と月がずれる問題を回避）
        int currentMonth = TEST_SHOT_AT.getMonthValue();
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
                        .param(PARAM_WEATHERS, String.valueOf(WEATHER_SUNNY)))
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
    @DisplayName("Issue#103 - ピンの色が条件合致数に基づいて決定される（10件以上=Yellow）")
    void testGetSpots_PinColor_TenPhotos_ReturnsYellow() throws Exception {
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
                .andExpect(jsonPath(JSON_PATH_PIN_COLOR, is(PIN_COLOR_YELLOW)));
    }

    @Test
    @DisplayName("Issue#103 - ピンの色が条件合致数に基づいて決定される（50件以上=Orange）")
    void testGetSpots_PinColor_FiftyPhotos_ReturnsOrange() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        for (int i = 0; i < PHOTO_COUNT_FIFTY; i++) {
            createPhoto(spot, LocalDateTime.now().minusMinutes(i + 1), WEATHER_SUNNY);
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
    @DisplayName("Issue#103 - ピンの色が条件合致数に基づいて決定される（100件以上=Red）")
    void testGetSpots_PinColor_HundredPhotos_ReturnsRed() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        for (int i = 0; i < PHOTO_COUNT_HUNDRED; i++) {
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
    @DisplayName("正常ケース - 期間外のみの写真しかないスポットもGreenピンで表示される")
    void testGetSpots_PhotoOutsidePeriod_SpotReturnedWithGreenPin() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);

        // 期間外の写真（500時間前 > 336時間）
        createPhoto(spot, TEST_SHOT_AT_OUTSIDE_PERIOD, WEATHER_SUNNY);

        // 期間外のみでもスポットは表示される（Greenピン、photoCount=1）
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
    @DisplayName("Issue#103 - photoCountは全期間のトータル件数、pinColorも全写真数で決定（10件→Yellow）")
    void testGetSpots_MixedPeriodPhotos_PhotoCountAndPinColorBasedOnTotal() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);

        // 期間内の写真1枚
        createPhoto(spot, LocalDateTime.now().minusHours(1), WEATHER_SUNNY);

        // 期間外の写真9枚（合計10枚で新閾値の Yellow ぴったり）
        for (int i = 0; i < 9; i++) {
            createPhoto(spot, TEST_SHOT_AT_OUTSIDE_PERIOD.minusHours(i), WEATHER_SUNNY);
        }

        // photoCount は全期間のトータル10枚、pinColor も全10枚ベースで Yellow
        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_PIN_COLOR, is(PIN_COLOR_YELLOW)))
                .andExpect(jsonPath(JSON_PATH_PHOTO_COUNT, is(10)));
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
                .andExpect(jsonPath(JSON_PATH_THUMBNAIL_URL, containsString("thumbnails/" + NEW_PHOTO_KEY)));
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
                        .param(PARAM_TIMES_OF_DAY, String.valueOf(TIME_OF_DAY_MORNING)))
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
                        .param(PARAM_TIMES_OF_DAY, String.valueOf(TIME_OF_DAY_MORNING), String.valueOf(TIME_OF_DAY_EVENING)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[*].spotId", containsInAnyOrder(
                        spot1.getSpotId().intValue(),
                        spot3.getSpotId().intValue()
                )));
    }

    // ============================================================
    // Issue#46: 詳細フィルター機能テスト
    // ============================================================

    // Test Data Constants - Issue#46 Advanced Filters
    private static final String PARAM_MIN_RESOLUTION = "min_resolution";
    private static final String PARAM_DEVICE_TYPES = "device_types";
    private static final String PARAM_MAX_AGE_DAYS = "max_age_days";
    private static final String PARAM_ASPECT_RATIOS = "aspect_ratios";
    private static final String PARAM_FOCAL_LENGTH_RANGES = "focal_length_ranges";
    private static final String PARAM_MAX_ISO = "max_iso";

    private static final int DEVICE_TYPE_SLR = CodeConstants.DEVICE_TYPE_SLR;
    private static final int DEVICE_TYPE_MIRRORLESS = CodeConstants.DEVICE_TYPE_MIRRORLESS;
    private static final int DEVICE_TYPE_COMPACT = CodeConstants.DEVICE_TYPE_COMPACT;
    private static final int DEVICE_TYPE_SMARTPHONE = CodeConstants.DEVICE_TYPE_SMARTPHONE;
    private static final int DEVICE_TYPE_FILM = CodeConstants.DEVICE_TYPE_FILM;
    private static final int DEVICE_TYPE_OTHER = CodeConstants.DEVICE_TYPE_OTHER;
    private static final String ASPECT_HORIZONTAL = "HORIZONTAL";
    private static final String ASPECT_VERTICAL = "VERTICAL";
    private static final String ASPECT_SQUARE = "SQUARE";
    private static final String FOCAL_WIDE = "WIDE";
    private static final String FOCAL_STANDARD = "STANDARD";
    private static final String FOCAL_TELEPHOTO = "TELEPHOTO";
    private static final String FOCAL_SUPER_TELEPHOTO = "SUPER_TELEPHOTO";

    @Test
    @DisplayName("Issue#46 - 解像度フィルター: 高画質のみ（長辺1080px以上）の写真のスポットのみ返される")
    void testGetSpots_WithMinResolution_ReturnsHighResOnly() throws Exception {
        // 高解像度の写真（横2000x縦1500）
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo hiRes = createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);
        hiRes.setImageWidth(2000);
        hiRes.setImageHeight(1500);
        photoRepository.save(hiRes);

        // 低解像度の写真（横800x縦600）
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        Photo loRes = createPhoto(spot2, TEST_SHOT_AT, WEATHER_SUNNY);
        loRes.setImageWidth(800);
        loRes.setImageHeight(600);
        photoRepository.save(loRes);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_MIN_RESOLUTION, "1080"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - 解像度フィルター: 解像度情報がnullの写真は除外される")
    void testGetSpots_WithMinResolution_ExcludesNullResolution() throws Exception {
        // 解像度情報なしの写真
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);  // imageWidth/heightはnull

        // 高解像度の写真
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        Photo hiRes = createPhoto(spot2, TEST_SHOT_AT, WEATHER_SUNNY);
        hiRes.setImageWidth(1920);
        hiRes.setImageHeight(1080);
        photoRepository.save(hiRes);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_MIN_RESOLUTION, "1080"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot2.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - 機材種別フィルター: SLRを指定するとSLRのみ返される")
    void testGetSpots_WithDeviceTypeSLR_ReturnsSLROnly() throws Exception {
        // 一眼レフの写真
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo slrPhoto = createPhotoWithDeviceType(spot1, TEST_SHOT_AT, WEATHER_SUNNY, DEVICE_TYPE_SLR);

        // スマートフォンの写真
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        createPhotoWithDeviceType(spot2, TEST_SHOT_AT, WEATHER_SUNNY, DEVICE_TYPE_SMARTPHONE);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_DEVICE_TYPES, String.valueOf(DEVICE_TYPE_SLR)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - 機材種別フィルター: MIRRORLESSを指定するとミラーレスのみ返される")
    void testGetSpots_WithDeviceTypeMirrorless_ReturnsMirrorlessOnly() throws Exception {
        // ミラーレスの写真
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhotoWithDeviceType(spot1, TEST_SHOT_AT, WEATHER_SUNNY, DEVICE_TYPE_MIRRORLESS);

        // 一眼レフの写真
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        createPhotoWithDeviceType(spot2, TEST_SHOT_AT, WEATHER_SUNNY, DEVICE_TYPE_SLR);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_DEVICE_TYPES, String.valueOf(DEVICE_TYPE_MIRRORLESS)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - 機材種別フィルター: SMARTPHONEを指定するとスマートフォンのみ返される")
    void testGetSpots_WithDeviceTypeSmartphone_ReturnsSmartphoneOnly() throws Exception {
        // ミラーレスの写真
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhotoWithDeviceType(spot1, TEST_SHOT_AT, WEATHER_SUNNY, DEVICE_TYPE_MIRRORLESS);

        // スマートフォンの写真
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        createPhotoWithDeviceType(spot2, TEST_SHOT_AT, WEATHER_SUNNY, DEVICE_TYPE_SMARTPHONE);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_DEVICE_TYPES, String.valueOf(DEVICE_TYPE_SMARTPHONE)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot2.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - 機材種別フィルター: device_typeがnullの写真は除外される")
    void testGetSpots_WithDeviceTypeFilter_ExcludesNullDeviceType() throws Exception {
        // device_type設定済みの写真
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhotoWithDeviceType(spot1, TEST_SHOT_AT, WEATHER_SUNNY, DEVICE_TYPE_COMPACT);

        // device_type未設定の写真
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        createPhoto(spot2, TEST_SHOT_AT, WEATHER_SUNNY);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_DEVICE_TYPES, String.valueOf(DEVICE_TYPE_COMPACT)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#63 - 鮮度フィルター: 365日以内の写真のスポットのみ返される")
    void testGetSpots_WithMaxAgeDays365_ReturnsRecentOnly() throws Exception {
        // 半年前の写真（365日以内）
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhoto(spot1, LocalDateTime.now().minusMonths(6), WEATHER_SUNNY);

        // 2年前の写真（365日超え）
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        createPhoto(spot2, LocalDateTime.now().minusYears(2), WEATHER_SUNNY);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_MAX_AGE_DAYS, "365"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#63 - 鮮度フィルター: 7日以内の写真のスポットのみ返される")
    void testGetSpots_WithMaxAgeDays7_ReturnsRecentOnly() throws Exception {
        // 3日前の写真（7日以内）
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhoto(spot1, LocalDateTime.now().minusDays(3), WEATHER_SUNNY);

        // 10日前の写真（7日超え）
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        createPhoto(spot2, LocalDateTime.now().minusDays(10), WEATHER_SUNNY);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_MAX_AGE_DAYS, "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - アスペクト比フィルター: HORIZONTALを指定すると横位置のみ返される")
    void testGetSpots_WithAspectRatioHorizontal_ReturnsHorizontalOnly() throws Exception {
        // 横位置（3000x2000）
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo horizontal = createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);
        horizontal.setImageWidth(3000);
        horizontal.setImageHeight(2000);
        photoRepository.save(horizontal);

        // 縦位置（2000x3000）
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        Photo vertical = createPhoto(spot2, TEST_SHOT_AT, WEATHER_SUNNY);
        vertical.setImageWidth(2000);
        vertical.setImageHeight(3000);
        photoRepository.save(vertical);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_ASPECT_RATIOS, ASPECT_HORIZONTAL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - アスペクト比フィルター: SQUAREは±5%の誤差を許容する")
    void testGetSpots_WithAspectRatioSquare_AllowsMargin() throws Exception {
        // ほぼ正方形（1000x1040 = 4%差）
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo almostSquare = createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);
        almostSquare.setImageWidth(1000);
        almostSquare.setImageHeight(1040);
        photoRepository.save(almostSquare);

        // 横位置（3000x2000）
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        Photo horizontal = createPhoto(spot2, TEST_SHOT_AT, WEATHER_SUNNY);
        horizontal.setImageWidth(3000);
        horizontal.setImageHeight(2000);
        photoRepository.save(horizontal);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_ASPECT_RATIOS, ASPECT_SQUARE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - 焦点距離フィルター: WIDEは24mm未満のみ返される")
    void testGetSpots_WithFocalLengthWide_ReturnsWideOnly() throws Exception {
        // 広角（16mm）
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo wide = createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);
        wide.setFocalLength35mm(16);
        photoRepository.save(wide);

        // 標準（50mm）
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        Photo standard = createPhoto(spot2, TEST_SHOT_AT, WEATHER_SUNNY);
        standard.setFocalLength35mm(50);
        photoRepository.save(standard);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_FOCAL_LENGTH_RANGES, FOCAL_WIDE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - 焦点距離フィルター: TELEPHOTOは70mm超300mm以下のみ返される")
    void testGetSpots_WithFocalLengthTelephoto_ReturnsTelephotoOnly() throws Exception {
        // 望遠（200mm）
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo tele = createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);
        tele.setFocalLength35mm(200);
        photoRepository.save(tele);

        // 標準（50mm）
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        Photo standard = createPhoto(spot2, TEST_SHOT_AT, WEATHER_SUNNY);
        standard.setFocalLength35mm(50);
        photoRepository.save(standard);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_FOCAL_LENGTH_RANGES, FOCAL_TELEPHOTO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - 焦点距離フィルター: TELEPHOTOは301mm以上を含まない")
    void testGetSpots_WithFocalLengthTelephoto_ExcludesSuperTelephoto() throws Exception {
        // 望遠（300mm - TELEPHOTOの上限）
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo tele = createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);
        tele.setFocalLength35mm(300);
        photoRepository.save(tele);

        // 超望遠（500mm）
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        Photo superTele = createPhoto(spot2, TEST_SHOT_AT, WEATHER_SUNNY);
        superTele.setFocalLength35mm(500);
        photoRepository.save(superTele);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_FOCAL_LENGTH_RANGES, FOCAL_TELEPHOTO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - 焦点距離フィルター: SUPER_TELEPHOTOは300mm超のみ返される")
    void testGetSpots_WithFocalLengthSuperTelephoto_ReturnsSuperTelephotoOnly() throws Exception {
        // 超望遠（500mm）
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo superTele = createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);
        superTele.setFocalLength35mm(500);
        photoRepository.save(superTele);

        // 望遠（200mm）
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        Photo tele = createPhoto(spot2, TEST_SHOT_AT, WEATHER_SUNNY);
        tele.setFocalLength35mm(200);
        photoRepository.save(tele);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_FOCAL_LENGTH_RANGES, FOCAL_SUPER_TELEPHOTO))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - ISO感度フィルター: max_iso=400で低感度のみ返される")
    void testGetSpots_WithMaxIso_ReturnsLowIsoOnly() throws Exception {
        // 低ISO（ISO 200）
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo lowIso = createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);
        lowIso.setIso(200);
        photoRepository.save(lowIso);

        // 高ISO（ISO 6400）
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        Photo highIso = createPhoto(spot2, TEST_SHOT_AT, WEATHER_SUNNY);
        highIso.setIso(6400);
        photoRepository.save(highIso);

        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_MAX_ISO, "400"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#46 - 基本フィルターと詳細フィルターの組み合わせ: 天気+焦点距離")
    void testGetSpots_CombinedBasicAndAdvanced_ReturnsIntersection() throws Exception {
        // 晴れ+広角
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo photo1 = createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);
        photo1.setFocalLength35mm(16);
        photoRepository.save(photo1);

        // 晴れ+望遠
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);
        Photo photo2 = createPhoto(spot2, TEST_SHOT_AT, WEATHER_SUNNY);
        photo2.setFocalLength35mm(200);
        photoRepository.save(photo2);

        // 曇り+広角
        Spot spot3 = createSpot(TEST_LATITUDE_3, TEST_LONGITUDE_3);
        Photo photo3 = createPhoto(spot3, TEST_SHOT_AT, WEATHER_CLOUDY);
        photo3.setFocalLength35mm(16);
        photoRepository.save(photo3);

        // 晴れ AND 広角 = spot1のみ
        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST)
                        .param(PARAM_WEATHERS, String.valueOf(WEATHER_SUNNY))
                        .param(PARAM_FOCAL_LENGTH_RANGES, FOCAL_WIDE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(spot1.getSpotId().intValue())));
    }

    // --- Issue#112: POST /spots/photos テスト（ページネーション対応） ---

    private static final String SPOTS_PHOTOS_ENDPOINT = "/api/v1/spots/photos";

    @Test
    @DisplayName("Issue#112 - 単一スポットの写真IDを撮影日降順で取得できる")
    void testGetSpotPhotos_SingleSpot_ReturnsIdsInDescOrder() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo photo1 = createPhoto(spot, TEST_SHOT_AT.minusHours(2), WEATHER_SUNNY);
        Photo photo2 = createPhoto(spot, TEST_SHOT_AT, WEATHER_CLOUDY);
        Photo photo3 = createPhoto(spot, TEST_SHOT_AT.minusHours(1), WEATHER_SUNNY);

        // 撮影日降順: photo2 → photo3 → photo1
        String body = String.format("{\"spotIds\":[%d],\"limit\":30,\"offset\":0}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(3)))
                .andExpect(jsonPath("$.ids[0]", is(photo2.getPhotoId().intValue())))
                .andExpect(jsonPath("$.ids[1]", is(photo3.getPhotoId().intValue())))
                .andExpect(jsonPath("$.ids[2]", is(photo1.getPhotoId().intValue())))
                .andExpect(jsonPath("$.total", is(3)));
    }

    @Test
    @DisplayName("Issue#112 - 写真が0件のスポットは空リストとtotal=0を返す")
    void testGetSpotPhotos_EmptySpot_ReturnsEmpty() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);

        String body = String.format("{\"spotIds\":[%d]}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(0)))
                .andExpect(jsonPath("$.total", is(0)));
    }

    @Test
    @DisplayName("Issue#112 - max_age_days で古い写真を除外する")
    void testGetSpotPhotos_MaxAgeDays_FiltersOldPhotos() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo recentPhoto = createPhoto(spot, LocalDateTime.now().minusDays(3), WEATHER_SUNNY);
        createPhoto(spot, LocalDateTime.now().minusDays(10), WEATHER_SUNNY);

        String body = String.format("{\"spotIds\":[%d],\"maxAgeDays\":7}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(1)))
                .andExpect(jsonPath("$.ids[0]", is(recentPhoto.getPhotoId().intValue())))
                .andExpect(jsonPath("$.total", is(1)));
    }

    @Test
    @DisplayName("Issue#112 - shot_at が null の写真は max_age_days フィルタを通過する")
    void testGetSpotPhotos_NullShotAt_PassesMaxAgeDaysFilter() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        // shot_at NULL の写真
        Photo nullShotAtPhoto = new Photo();
        nullShotAtPhoto.setS3ObjectKey(TEST_S3_OBJECT_KEY + "-null-" + System.nanoTime());
        nullShotAtPhoto.setSpotId(spot.getSpotId());
        nullShotAtPhoto.setUserId(testUser.getId());
        nullShotAtPhoto.setShotAt(null);
        nullShotAtPhoto.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        nullShotAtPhoto = photoRepository.save(nullShotAtPhoto);

        // 古い写真（フィルタ対象）
        createPhoto(spot, LocalDateTime.now().minusDays(10), WEATHER_SUNNY);

        String body = String.format("{\"spotIds\":[%d],\"maxAgeDays\":7}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(1)))
                .andExpect(jsonPath("$.ids[0]", is(nullShotAtPhoto.getPhotoId().intValue())))
                .andExpect(jsonPath("$.total", is(1)));
    }

    @Test
    @DisplayName("Issue#112 - shot_at NULL の写真は並び順で末尾に来る（NULLS LAST）")
    void testGetSpotPhotos_NullShotAt_OrderedLast() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo withDate1 = createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);
        Photo nullShotAt = new Photo();
        nullShotAt.setS3ObjectKey(TEST_S3_OBJECT_KEY + "-null-" + System.nanoTime());
        nullShotAt.setSpotId(spot.getSpotId());
        nullShotAt.setUserId(testUser.getId());
        nullShotAt.setShotAt(null);
        nullShotAt.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        nullShotAt = photoRepository.save(nullShotAt);
        Photo withDate2 = createPhoto(spot, TEST_SHOT_AT.minusHours(1), WEATHER_SUNNY);

        String body = String.format("{\"spotIds\":[%d]}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(3)))
                // 撮影日のある写真が先頭、NULL は末尾
                .andExpect(jsonPath("$.ids[0]", is(withDate1.getPhotoId().intValue())))
                .andExpect(jsonPath("$.ids[1]", is(withDate2.getPhotoId().intValue())))
                .andExpect(jsonPath("$.ids[2]", is(nullShotAt.getPhotoId().intValue())));
    }

    @Test
    @DisplayName("Issue#112 - 同じ shot_at では photo_id 降順で並ぶ（tiebreaker）")
    void testGetSpotPhotos_SameShotAt_OrderedByPhotoIdDesc() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo photo1 = createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);
        Photo photo2 = createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);
        Photo photo3 = createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);

        // photoId は INSERT 順に増える前提。tiebreaker は photo_id DESC
        String body = String.format("{\"spotIds\":[%d]}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids[0]", is(photo3.getPhotoId().intValue())))
                .andExpect(jsonPath("$.ids[1]", is(photo2.getPhotoId().intValue())))
                .andExpect(jsonPath("$.ids[2]", is(photo1.getPhotoId().intValue())));
    }

    @Test
    @DisplayName("Issue#112 - 複数スポットを横断してマージしたページが返る（撮影日降順）")
    void testGetSpotPhotos_MultipleSpots_MergedAndSorted() throws Exception {
        Spot spot1 = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Spot spot2 = createSpot(TEST_LATITUDE_2, TEST_LONGITUDE_2);

        Photo p1Recent = createPhoto(spot1, TEST_SHOT_AT, WEATHER_SUNNY);
        Photo p2Old = createPhoto(spot2, TEST_SHOT_AT.minusHours(2), WEATHER_SUNNY);
        Photo p2Mid = createPhoto(spot2, TEST_SHOT_AT.minusHours(1), WEATHER_SUNNY);

        String body = String.format("{\"spotIds\":[%d,%d]}", spot1.getSpotId(), spot2.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(3)))
                // 撮影日降順でマージ: p1Recent → p2Mid → p2Old
                .andExpect(jsonPath("$.ids[0]", is(p1Recent.getPhotoId().intValue())))
                .andExpect(jsonPath("$.ids[1]", is(p2Mid.getPhotoId().intValue())))
                .andExpect(jsonPath("$.ids[2]", is(p2Old.getPhotoId().intValue())))
                .andExpect(jsonPath("$.total", is(3)));
    }

    @Test
    @DisplayName("Issue#112 - limit と offset でページングできる")
    void testGetSpotPhotos_LimitAndOffset_Paginates() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        // 撮影日順に photo1 (oldest) ... photo5 (newest)
        Photo photo1 = createPhoto(spot, TEST_SHOT_AT.minusHours(4), WEATHER_SUNNY);
        Photo photo2 = createPhoto(spot, TEST_SHOT_AT.minusHours(3), WEATHER_SUNNY);
        Photo photo3 = createPhoto(spot, TEST_SHOT_AT.minusHours(2), WEATHER_SUNNY);
        Photo photo4 = createPhoto(spot, TEST_SHOT_AT.minusHours(1), WEATHER_SUNNY);
        Photo photo5 = createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);

        // 1 ページ目: limit=2, offset=0 → photo5, photo4
        String page1 = String.format("{\"spotIds\":[%d],\"limit\":2,\"offset\":0}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(page1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(2)))
                .andExpect(jsonPath("$.ids[0]", is(photo5.getPhotoId().intValue())))
                .andExpect(jsonPath("$.ids[1]", is(photo4.getPhotoId().intValue())))
                .andExpect(jsonPath("$.total", is(5)));

        // 2 ページ目: limit=2, offset=2 → photo3, photo2
        String page2 = String.format("{\"spotIds\":[%d],\"limit\":2,\"offset\":2}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(page2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(2)))
                .andExpect(jsonPath("$.ids[0]", is(photo3.getPhotoId().intValue())))
                .andExpect(jsonPath("$.ids[1]", is(photo2.getPhotoId().intValue())))
                .andExpect(jsonPath("$.total", is(5)));

        // 3 ページ目: limit=2, offset=4 → photo1
        String page3 = String.format("{\"spotIds\":[%d],\"limit\":2,\"offset\":4}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(page3))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(1)))
                .andExpect(jsonPath("$.ids[0]", is(photo1.getPhotoId().intValue())))
                .andExpect(jsonPath("$.total", is(5)));
    }

    @Test
    @DisplayName("Issue#112 - limit / offset 省略時はデフォルト値（30, 0）が使われる")
    void testGetSpotPhotos_DefaultLimitAndOffset() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);

        String body = String.format("{\"spotIds\":[%d]}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(1)))
                .andExpect(jsonPath("$.total", is(1)));
    }

    @Test
    @DisplayName("Issue#112 - 退会済みユーザーの写真は除外される")
    void testGetSpotPhotos_DeletedUser_PhotosExcluded() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo activePhoto = createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);

        User deletedUser = new User();
        deletedUser.setUsername("退会済み112");
        deletedUser.setEmail("deleted-112@example.com");
        deletedUser.setPasswordHash("hashedpassword");
        deletedUser.setRole(CodeConstants.ROLE_USER);
        deletedUser.setDeletedAt(java.time.LocalDateTime.now());
        deletedUser = userRepository.save(deletedUser);

        Photo deletedUserPhoto = new Photo();
        deletedUserPhoto.setSpotId(spot.getSpotId());
        deletedUserPhoto.setUserId(deletedUser.getId());
        deletedUserPhoto.setS3ObjectKey("uploads/" + deletedUser.getId() + "/deleted-photo.jpg");
        deletedUserPhoto.setShotAt(TEST_SHOT_AT.plusHours(1));
        deletedUserPhoto.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        photoRepository.save(deletedUserPhoto);

        String body = String.format("{\"spotIds\":[%d]}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(1)))
                .andExpect(jsonPath("$.ids[0]", is(activePhoto.getPhotoId().intValue())))
                .andExpect(jsonPath("$.total", is(1)));
    }

    @Test
    @DisplayName("Issue#112 - PUBLISHED 以外のモデレーションステータスの写真は除外される")
    void testGetSpotPhotos_OnlyPublished() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);

        Photo published = createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);
        // QUARANTINED
        Photo quarantined = createPhoto(spot, TEST_SHOT_AT.minusHours(1), WEATHER_SUNNY);
        quarantined.setModerationStatus(CodeConstants.MODERATION_STATUS_QUARANTINED);
        photoRepository.save(quarantined);
        // REMOVED
        Photo removed = createPhoto(spot, TEST_SHOT_AT.minusHours(2), WEATHER_SUNNY);
        removed.setModerationStatus(CodeConstants.MODERATION_STATUS_REMOVED);
        photoRepository.save(removed);

        String body = String.format("{\"spotIds\":[%d]}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(1)))
                .andExpect(jsonPath("$.ids[0]", is(published.getPhotoId().intValue())))
                .andExpect(jsonPath("$.total", is(1)));
    }

    @Test
    @DisplayName("Issue#112 - 存在しない spot_id を含めてもエラーにならない（その分は単に件数0）")
    void testGetSpotPhotos_NonExistentSpotId_NoError() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo photo = createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);

        String body = String.format("{\"spotIds\":[%d, 99999]}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ids", hasSize(1)))
                .andExpect(jsonPath("$.ids[0]", is(photo.getPhotoId().intValue())))
                .andExpect(jsonPath("$.total", is(1)));
    }

    @Test
    @DisplayName("Issue#112 - spot_ids が空の場合は400")
    void testGetSpotPhotos_EmptySpotIds_BadRequest() throws Exception {
        String body = "{\"spotIds\":[]}";
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#112 - spot_ids が省略された場合は400")
    void testGetSpotPhotos_MissingSpotIds_BadRequest() throws Exception {
        String body = "{}";
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#112 - limit が101以上の場合は400")
    void testGetSpotPhotos_LimitTooLarge_BadRequest() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        String body = String.format("{\"spotIds\":[%d],\"limit\":101}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#112 - limit が0の場合は400")
    void testGetSpotPhotos_LimitZero_BadRequest() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        String body = String.format("{\"spotIds\":[%d],\"limit\":0}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#112 - limit が負値の場合は400")
    void testGetSpotPhotos_LimitNegative_BadRequest() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        String body = String.format("{\"spotIds\":[%d],\"limit\":-1}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#112 - offset が負値の場合は400")
    void testGetSpotPhotos_OffsetNegative_BadRequest() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        String body = String.format("{\"spotIds\":[%d],\"offset\":-1}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#112 - max_age_days が負値の場合は400")
    void testGetSpotPhotos_MaxAgeDaysNegative_BadRequest() throws Exception {
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        String body = String.format("{\"spotIds\":[%d],\"maxAgeDays\":-1}", spot.getSpotId());
        mockMvc.perform(post(SPOTS_PHOTOS_ENDPOINT)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    // --- Issue#54: モデレーションステータスによるフィルタリングテスト ---

    @Test
    @DisplayName("Issue#54 - QUARANTINED写真はスポット検索結果に含まれない")
    void testGetSpots_QuarantinedPhotosExcluded() throws Exception {
        // Given: スポットにQUARANTINED写真のみ
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo photo = createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_QUARANTINED);
        photoRepository.save(photo);

        // When & Then: スポットが結果に含まれない
        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("Issue#54 - REMOVED写真はスポット検索結果に含まれない")
    void testGetSpots_RemovedPhotosExcluded() throws Exception {
        // Given: スポットにREMOVED写真のみ
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo photo = createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_REMOVED);
        photoRepository.save(photo);

        // When & Then: スポットが結果に含まれない
        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("Issue#54 - PENDING_REVIEW写真はスポット検索結果に含まれない")
    void testGetSpots_PendingReviewPhotosExcluded() throws Exception {
        // Given: スポットにPENDING_REVIEW写真のみ
        Spot spot = createSpot(TEST_LATITUDE, TEST_LONGITUDE);
        Photo photo = createPhoto(spot, TEST_SHOT_AT, WEATHER_SUNNY);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PENDING_REVIEW);
        photoRepository.save(photo);

        // When & Then: スポットが結果に含まれない
        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    // ヘルパーメソッド
    private Spot createSpot(BigDecimal latitude, BigDecimal longitude) {
        Spot spot = new Spot();
        spot.setLatitude(latitude);
        spot.setLongitude(longitude);
        spot.setCreatedByUserId(testUser.getId());
        return spotRepository.save(spot);
    }

    private Photo createPhoto(Spot spot, LocalDateTime shotAt, Integer weather) {
        Photo photo = new Photo();
        photo.setS3ObjectKey(TEST_S3_OBJECT_KEY + "-" + System.nanoTime());
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setShotAt(shotAt);
        photo.setWeather(weather);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        List<Category> categories = new ArrayList<>();
        categories.add(category1);
        photo.setCategories(categories);
        return photoRepository.save(photo);
    }

    private Photo createPhotoWithDeviceType(Spot spot, LocalDateTime shotAt, Integer weather, Integer deviceType) {
        Photo photo = new Photo();
        photo.setS3ObjectKey(TEST_S3_OBJECT_KEY + "-" + System.nanoTime());
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setShotAt(shotAt);
        photo.setWeather(weather);
        photo.setDeviceType(deviceType);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        List<Category> categories = new ArrayList<>();
        categories.add(category1);
        photo.setCategories(categories);
        return photoRepository.save(photo);
    }

    private Photo createPhotoWithTimeOfDay(Spot spot, LocalDateTime shotAt, Integer weather, Integer timeOfDay) {
        Photo photo = new Photo();
        photo.setS3ObjectKey(TEST_S3_OBJECT_KEY + "-" + System.nanoTime());
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setShotAt(shotAt);
        photo.setWeather(weather);
        photo.setTimeOfDay(timeOfDay);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        List<Category> categories = new ArrayList<>();
        categories.add(category1);
        photo.setCategories(categories);
        return photoRepository.save(photo);
    }

    // ============================================================
    // Issue#72: ソフトデリート - 退会済みユーザーの写真除外テスト
    // ============================================================

    @Test
    @DisplayName("Issue#72 - 退会済みユーザーの写真はスポット検索結果に含まれない")
    void testGetSpots_DeletedUserPhotos_ExcludedFromResults() throws Exception {
        // 退会済みユーザーを作成
        User deletedUser = new User();
        deletedUser.setUsername("deleteduser");
        deletedUser.setEmail("deleted@example.com");
        deletedUser.setPasswordHash(TEST_PASSWORD_HASH);
        deletedUser.setRole(CodeConstants.ROLE_USER);
        deletedUser.setDeletedAt(LocalDateTime.now().minusDays(1));
        deletedUser = userRepository.save(deletedUser);

        // 退会済みユーザーの写真のみのスポット
        Spot spot = new Spot();
        spot.setLatitude(TEST_LATITUDE);
        spot.setLongitude(TEST_LONGITUDE);
        spot.setCreatedByUserId(deletedUser.getId());
        spot = spotRepository.save(spot);

        Photo photo = new Photo();
        photo.setS3ObjectKey(TEST_S3_OBJECT_KEY + "-deleted-" + System.nanoTime());
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(deletedUser.getId());
        photo.setShotAt(TEST_SHOT_AT);
        photo.setWeather(WEATHER_SUNNY);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        photoRepository.save(photo);

        // 検索結果に含まれないことを確認
        mockMvc.perform(get(SPOTS_ENDPOINT)
                        .param(PARAM_NORTH, BOUND_NORTH)
                        .param(PARAM_SOUTH, BOUND_SOUTH)
                        .param(PARAM_EAST, BOUND_EAST)
                        .param(PARAM_WEST, BOUND_WEST))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }
}
