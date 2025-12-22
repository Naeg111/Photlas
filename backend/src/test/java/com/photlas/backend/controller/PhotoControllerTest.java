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

/**
 * Issue#14: 写真詳細情報取得API
 * TDD Red段階のテストコード
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class PhotoControllerTest {

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
    private Category category;
    private Spot spot;

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
        testUser.setProfileImageUrl("https://example.com/profile.jpg");
        testUser.setTwitterUrl("https://twitter.com/testuser");
        testUser.setInstagramUrl("https://instagram.com/testuser");
        testUser = userRepository.save(testUser);

        // JWTトークンを生成
        token = jwtService.generateToken(testUser.getEmail());

        // カテゴリを作成
        category = new Category();
        category.setName("風景");
        category = categoryRepository.save(category);

        // スポットを作成
        spot = new Spot();
        spot.setLatitude(new BigDecimal("35.6585"));
        spot.setLongitude(new BigDecimal("139.7454"));
        spot.setCreatedByUserId(testUser.getId());
        spot = spotRepository.save(spot);
    }

    @Test
    @DisplayName("Issue#14 - GET /api/v1/photos/{photoId} - 写真詳細情報を取得")
    void testGetPhotoDetail_ReturnsPhotoDetail() throws Exception {
        // 写真を作成
        Photo photo = new Photo();
        photo.setTitle("Test Photo Title");
        photo.setS3ObjectKey("test-key");
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setShotAt(LocalDateTime.of(2024, 1, 15, 14, 30));
        photo.setWeather("晴れ");
        photo.setTimeOfDay("DAY");
        photo.setSubjectCategory("LANDSCAPE");
        photo.setCameraBody("Canon EOS R5");
        photo.setCameraLens("RF 24-70mm f/2.8L");
        photo.setFValue("f/2.8");
        photo.setShutterSpeed("1/1000");
        photo.setIso("400");
        List<Category> categories = new ArrayList<>();
        categories.add(category);
        photo.setCategories(categories);
        photo = photoRepository.save(photo);

        // APIリクエスト
        mockMvc.perform(get("/api/v1/photos/" + photo.getPhotoId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                // 基本情報
                .andExpect(jsonPath("$.photoId", is(photo.getPhotoId().intValue())))
                .andExpect(jsonPath("$.title", is("Test Photo Title")))
                .andExpect(jsonPath("$.imageUrls.thumbnail", notNullValue()))
                .andExpect(jsonPath("$.imageUrls.standard", notNullValue()))
                .andExpect(jsonPath("$.imageUrls.original", notNullValue()))
                .andExpect(jsonPath("$.shotAt", is("2024-01-15T14:30:00")))
                // 撮影コンテキスト
                .andExpect(jsonPath("$.weather", is("晴れ")))
                .andExpect(jsonPath("$.timeOfDay", is("DAY")))
                .andExpect(jsonPath("$.subjectCategory", is("LANDSCAPE")))
                // カメラ情報
                .andExpect(jsonPath("$.cameraInfo.body", is("Canon EOS R5")))
                .andExpect(jsonPath("$.cameraInfo.lens", is("RF 24-70mm f/2.8L")))
                .andExpect(jsonPath("$.cameraInfo.fValue", is("f/2.8")))
                .andExpect(jsonPath("$.cameraInfo.shutterSpeed", is("1/1000")))
                .andExpect(jsonPath("$.cameraInfo.iso", is("400")))
                // 投稿者情報
                .andExpect(jsonPath("$.user.userId", is(testUser.getId().intValue())))
                .andExpect(jsonPath("$.user.username", is("testuser")))
                .andExpect(jsonPath("$.user.profileImageUrl", is("https://example.com/profile.jpg")))
                .andExpect(jsonPath("$.user.snsLinks.twitter", is("https://twitter.com/testuser")))
                .andExpect(jsonPath("$.user.snsLinks.instagram", is("https://instagram.com/testuser")))
                // スポット情報
                .andExpect(jsonPath("$.spot.spotId", is(spot.getSpotId().intValue())));
    }

    @Test
    @DisplayName("Issue#14 - GET /api/v1/photos/{photoId} - カメラ情報がnullの場合")
    void testGetPhotoDetail_WithNullCameraInfo() throws Exception {
        // カメラ情報なしの写真を作成
        Photo photo = new Photo();
        photo.setTitle("Test Photo");
        photo.setS3ObjectKey("test-key");
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setShotAt(LocalDateTime.of(2024, 1, 15, 14, 30));
        photo.setWeather("晴れ");
        // カメラ情報はnull
        List<Category> categories = new ArrayList<>();
        categories.add(category);
        photo.setCategories(categories);
        photo = photoRepository.save(photo);

        // APIリクエスト
        mockMvc.perform(get("/api/v1/photos/" + photo.getPhotoId())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$.cameraInfo.body").doesNotExist())
                .andExpect(jsonPath("$.cameraInfo.lens").doesNotExist())
                .andExpect(jsonPath("$.cameraInfo.fValue").doesNotExist())
                .andExpect(jsonPath("$.cameraInfo.shutterSpeed").doesNotExist())
                .andExpect(jsonPath("$.cameraInfo.iso").doesNotExist());
    }

    @Test
    @DisplayName("Issue#14 - GET /api/v1/photos/{photoId} - 存在しない写真で404")
    void testGetPhotoDetail_NotFound() throws Exception {
        mockMvc.perform(get("/api/v1/photos/99999")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#14 - GET /api/v1/photos/{photoId} - 認証なしで401")
    void testGetPhotoDetail_Unauthorized() throws Exception {
        // 写真を作成
        Photo photo = new Photo();
        photo.setTitle("Test Photo");
        photo.setS3ObjectKey("test-key");
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(testUser.getId());
        photo.setShotAt(LocalDateTime.now());
        List<Category> categories = new ArrayList<>();
        categories.add(category);
        photo.setCategories(categories);
        photo = photoRepository.save(photo);

        // 認証なしでリクエスト
        mockMvc.perform(get("/api/v1/photos/" + photo.getPhotoId()))
                .andExpect(status().isUnauthorized());
    }
}
