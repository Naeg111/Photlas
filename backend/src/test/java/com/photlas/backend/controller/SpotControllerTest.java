package com.photlas.backend.controller;

import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
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

    private User testUser;
    private String token;
    private Category category1;
    private Category category2;

    @BeforeEach
    void setUp() {
        // クリーンアップ
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();

        // テストユーザーを作成
        testUser = new User();
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash("hashedpassword");
        testUser.setRole("USER");
        testUser = userRepository.save(testUser);

        // JWTトークンを生成
        token = jwtService.generateToken(testUser.getEmail());

        // カテゴリマスターデータを作成
        category1 = new Category();
        category1.setName("風景");
        category1 = categoryRepository.save(category1);

        category2 = new Category();
        category2.setName("都市・街並み");
        category2 = categoryRepository.save(category2);
    }

    @Test
    @DisplayName("正常ケース - 範囲内のスポットを取得")
    void testGetSpots_WithinBounds_ReturnsSpots() throws Exception {
        // スポットとフォトを作成
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.6585"));
        spot.setLongitude(new BigDecimal("139.7454"));
        spot.setCreatedByUserId(testUser.getId());
        spot = spotRepository.save(spot);

        Photo photo = new Photo();
        photo.setTitle("Test Photo");
        photo.setS3ObjectKey("test-key");
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setShotAt(LocalDateTime.of(2025, 12, 15, 12, 0));
        photo.setWeather("Sunny");
        List<Category> categories = new ArrayList<>();
        categories.add(category1);
        photo.setCategories(categories);
        photoRepository.save(photo);

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThan(0))))
                .andExpect(jsonPath("$[0].spotId", is(spot.getSpotId().intValue())))
                .andExpect(jsonPath("$[0].latitude", is(35.6585)))
                .andExpect(jsonPath("$[0].longitude", is(139.7454)))
                .andExpect(jsonPath("$[0].pinColor", notNullValue()))
                .andExpect(jsonPath("$[0].thumbnailUrl", notNullValue()))
                .andExpect(jsonPath("$[0].photoCount", greaterThan(0)));
    }

    @Test
    @DisplayName("正常ケース - フィルター条件でスポットを取得（月指定）")
    void testGetSpots_WithMonthFilter_ReturnsFilteredSpots() throws Exception {
        // 12月の写真
        Spot spot1 = createSpot(new BigDecimal("35.6585"), new BigDecimal("139.7454"));
        createPhoto(spot1, LocalDateTime.of(2025, 12, 15, 12, 0), "Sunny");

        // 8月の写真
        Spot spot2 = createSpot(new BigDecimal("35.6586"), new BigDecimal("139.7455"));
        createPhoto(spot2, LocalDateTime.of(2025, 8, 15, 12, 0), "Sunny");

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7")
                        .param("months", "12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].spotId", is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("正常ケース - フィルター条件でスポットを取得（天気指定）")
    void testGetSpots_WithWeatherFilter_ReturnsFilteredSpots() throws Exception {
        // Sunny の写真
        Spot spot1 = createSpot(new BigDecimal("35.6585"), new BigDecimal("139.7454"));
        createPhoto(spot1, LocalDateTime.of(2025, 12, 15, 12, 0), "Sunny");

        // Cloudy の写真
        Spot spot2 = createSpot(new BigDecimal("35.6586"), new BigDecimal("139.7455"));
        createPhoto(spot2, LocalDateTime.of(2025, 12, 15, 12, 0), "Cloudy");

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7")
                        .param("weathers", "Sunny"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].spotId", is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("正常ケース - フィルター条件でスポットを取得（被写体種別指定）")
    void testGetSpots_WithSubjectCategoryFilter_ReturnsFilteredSpots() throws Exception {
        // category1 の写真
        Spot spot1 = createSpot(new BigDecimal("35.6585"), new BigDecimal("139.7454"));
        Photo photo1 = createPhoto(spot1, LocalDateTime.of(2025, 12, 15, 12, 0), "Sunny");
        List<Category> categories1 = new ArrayList<>();
        categories1.add(category1);
        photo1.setCategories(categories1);
        photoRepository.save(photo1);

        // category2 の写真
        Spot spot2 = createSpot(new BigDecimal("35.6586"), new BigDecimal("139.7455"));
        Photo photo2 = createPhoto(spot2, LocalDateTime.of(2025, 12, 15, 12, 0), "Sunny");
        List<Category> categories2 = new ArrayList<>();
        categories2.add(category2);
        photo2.setCategories(categories2);
        photoRepository.save(photo2);

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7")
                        .param("subject_categories", String.valueOf(category1.getCategoryId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].spotId", is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("正常ケース - ピンの色が条件合致数に基づいて決定される（1件=Green）")
    void testGetSpots_PinColor_OnePhoto_ReturnsGreen() throws Exception {
        Spot spot = createSpot(new BigDecimal("35.6585"), new BigDecimal("139.7454"));
        createPhoto(spot, LocalDateTime.of(2025, 12, 15, 12, 0), "Sunny");

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].pinColor", is("Green")));
    }

    @Test
    @DisplayName("正常ケース - ピンの色が条件合致数に基づいて決定される（5件以上=Yellow）")
    void testGetSpots_PinColor_FivePhotos_ReturnsYellow() throws Exception {
        Spot spot = createSpot(new BigDecimal("35.6585"), new BigDecimal("139.7454"));
        for (int i = 0; i < 5; i++) {
            createPhoto(spot, LocalDateTime.of(2025, 12, 15 + i, 12, 0), "Sunny");
        }

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].pinColor", is("Yellow")));
    }

    @Test
    @DisplayName("正常ケース - ピンの色が条件合致数に基づいて決定される（10件以上=Orange）")
    void testGetSpots_PinColor_TenPhotos_ReturnsOrange() throws Exception {
        Spot spot = createSpot(new BigDecimal("35.6585"), new BigDecimal("139.7454"));
        for (int i = 0; i < 10; i++) {
            createPhoto(spot, LocalDateTime.of(2025, 12, 15, 12, i), "Sunny");
        }

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].pinColor", is("Orange")));
    }

    @Test
    @DisplayName("正常ケース - ピンの色が条件合致数に基づいて決定される（30件以上=Red）")
    void testGetSpots_PinColor_ThirtyPhotos_ReturnsRed() throws Exception {
        Spot spot = createSpot(new BigDecimal("35.6585"), new BigDecimal("139.7454"));
        for (int i = 0; i < 30; i++) {
            createPhoto(spot, LocalDateTime.of(2025, 12, 15, 12, i), "Sunny");
        }

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].pinColor", is("Red")));
    }

    @Test
    @DisplayName("正常ケース - レスポンス件数制限（最大50件）")
    void testGetSpots_LimitTo50_Returns50Spots() throws Exception {
        // 60件のスポットを作成
        for (int i = 0; i < 60; i++) {
            Spot spot = createSpot(
                    new BigDecimal("35.65").add(new BigDecimal("0.001").multiply(new BigDecimal(i))),
                    new BigDecimal("139.74").add(new BigDecimal("0.001").multiply(new BigDecimal(i)))
            );
            createPhoto(spot, LocalDateTime.of(2025, 12, 15, 12, 0), "Sunny");
        }

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "36.0")
                        .param("south", "35.0")
                        .param("east", "140.0")
                        .param("west", "139.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(50)));
    }

    @Test
    @DisplayName("正常ケース - 条件合致数が多い順に返される")
    void testGetSpots_OrderByPhotoCount_ReturnsOrderedSpots() throws Exception {
        // スポット1: 写真1枚
        Spot spot1 = createSpot(new BigDecimal("35.6585"), new BigDecimal("139.7454"));
        createPhoto(spot1, LocalDateTime.of(2025, 12, 15, 12, 0), "Sunny");

        // スポット2: 写真3枚
        Spot spot2 = createSpot(new BigDecimal("35.6586"), new BigDecimal("139.7455"));
        for (int i = 0; i < 3; i++) {
            createPhoto(spot2, LocalDateTime.of(2025, 12, 15, 12, i), "Sunny");
        }

        // スポット3: 写真5枚
        Spot spot3 = createSpot(new BigDecimal("35.6587"), new BigDecimal("139.7456"));
        for (int i = 0; i < 5; i++) {
            createPhoto(spot3, LocalDateTime.of(2025, 12, 15, 12, i), "Sunny");
        }

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].spotId", is(spot3.getSpotId().intValue())))
                .andExpect(jsonPath("$[0].photoCount", is(5)))
                .andExpect(jsonPath("$[1].spotId", is(spot2.getSpotId().intValue())))
                .andExpect(jsonPath("$[1].photoCount", is(3)))
                .andExpect(jsonPath("$[2].spotId", is(spot1.getSpotId().intValue())))
                .andExpect(jsonPath("$[2].photoCount", is(1)));
    }

    @Test
    @DisplayName("正常ケース - サムネイルURLは最新の写真から取得される")
    void testGetSpots_ThumbnailUrl_ReturnsLatestPhoto() throws Exception {
        Spot spot = createSpot(new BigDecimal("35.6585"), new BigDecimal("139.7454"));

        // 古い写真
        Photo oldPhoto = createPhoto(spot, LocalDateTime.of(2025, 12, 10, 12, 0), "Sunny");
        oldPhoto.setS3ObjectKey("old-photo-key");
        photoRepository.save(oldPhoto);

        // 新しい写真
        Photo newPhoto = createPhoto(spot, LocalDateTime.of(2025, 12, 20, 12, 0), "Sunny");
        newPhoto.setS3ObjectKey("new-photo-key");
        photoRepository.save(newPhoto);

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].thumbnailUrl", containsString("new-photo-key")));
    }

    @Test
    @DisplayName("バリデーションエラー - 範囲パラメータが不足している場合")
    void testGetSpots_MissingBoundsParams_ReturnsBadRequest() throws Exception {
        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("正常ケース - 条件に合致する写真が0件のスポットは含まれない")
    void testGetSpots_NoMatchingPhotos_ReturnsEmptyList() throws Exception {
        // 12月の写真のみ
        Spot spot = createSpot(new BigDecimal("35.6585"), new BigDecimal("139.7454"));
        createPhoto(spot, LocalDateTime.of(2025, 12, 15, 12, 0), "Sunny");

        // 8月でフィルター（合致なし）
        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7")
                        .param("months", "8"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("正常ケース - フィルター条件でスポットを取得（時間帯指定）")
    void testGetSpots_WithTimeOfDayFilter_ReturnsFilteredSpots() throws Exception {
        // MORNING の写真
        Spot spot1 = createSpot(new BigDecimal("35.6585"), new BigDecimal("139.7454"));
        Photo photo1 = createPhotoWithTimeOfDay(spot1, LocalDateTime.of(2025, 12, 15, 12, 0), "Sunny", "MORNING");

        // EVENING の写真
        Spot spot2 = createSpot(new BigDecimal("35.6586"), new BigDecimal("139.7455"));
        Photo photo2 = createPhotoWithTimeOfDay(spot2, LocalDateTime.of(2025, 12, 15, 18, 0), "Sunny", "EVENING");

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7")
                        .param("times_of_day", "MORNING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].spotId", is(spot1.getSpotId().intValue())));
    }

    @Test
    @DisplayName("正常ケース - フィルター条件でスポットを取得（複数の時間帯指定）")
    void testGetSpots_WithMultipleTimesOfDay_ReturnsFilteredSpots() throws Exception {
        // MORNING の写真
        Spot spot1 = createSpot(new BigDecimal("35.6585"), new BigDecimal("139.7454"));
        createPhotoWithTimeOfDay(spot1, LocalDateTime.of(2025, 12, 15, 8, 0), "Sunny", "MORNING");

        // DAY の写真
        Spot spot2 = createSpot(new BigDecimal("35.6586"), new BigDecimal("139.7455"));
        createPhotoWithTimeOfDay(spot2, LocalDateTime.of(2025, 12, 15, 14, 0), "Sunny", "DAY");

        // EVENING の写真
        Spot spot3 = createSpot(new BigDecimal("35.6587"), new BigDecimal("139.7456"));
        createPhotoWithTimeOfDay(spot3, LocalDateTime.of(2025, 12, 15, 18, 0), "Sunny", "EVENING");

        mockMvc.perform(get("/api/v1/spots")
                        .param("north", "35.7")
                        .param("south", "35.6")
                        .param("east", "139.8")
                        .param("west", "139.7")
                        .param("times_of_day", "MORNING", "EVENING"))
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
        photo.setTitle("Test Photo");
        photo.setS3ObjectKey("test-key-" + System.nanoTime());
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
        photo.setTitle("Test Photo");
        photo.setS3ObjectKey("test-key-" + System.nanoTime());
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
