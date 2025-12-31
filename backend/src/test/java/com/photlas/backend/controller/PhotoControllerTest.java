package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.FavoriteRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.JwtService;
import com.photlas.backend.service.S3Service;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class PhotoControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private CategoryRepository categoryRepository;

    @Autowired
    private FavoriteRepository favoriteRepository;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private S3Service s3Service;

    private User testUser;
    private String token;

    @BeforeEach
    void setUp() {
        // クリーンアップ
        favoriteRepository.deleteAll();
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
        Category category1 = new Category();
        category1.setName("風景");
        categoryRepository.save(category1);

        Category category2 = new Category();
        category2.setName("都市・街並み");
        categoryRepository.save(category2);

        Category category3 = new Category();
        category3.setName("建築");
        categoryRepository.save(category3);

        // S3Serviceのモック設定
        when(s3Service.generatePresignedUploadUrl(anyString(), anyLong(), anyString(), anyString()))
                .thenAnswer(invocation -> {
                    String folder = invocation.getArgument(0);
                    Long userId = invocation.getArgument(1);
                    String extension = invocation.getArgument(2);
                    String objectKey = String.format("%s/%d/test-uuid.%s", folder, userId, extension);
                    String uploadUrl = "https://test-bucket.s3.us-east-1.amazonaws.com/" + objectKey + "?signature=test";
                    return new S3Service.UploadUrlResult(uploadUrl, objectKey);
                });
    }

    @Test
    @DisplayName("正常ケース - 新規スポット作成を伴う写真投稿")
    void testCreatePhoto_NewSpot_ReturnsCreatedWithPhotoData() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("東京タワーの夜景");
        request.setS3ObjectKey("photos/user123/image001.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景", "都市・街並み"));

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.photo.title", is("東京タワーの夜景")))
                .andExpect(jsonPath("$.photo.photo_id").exists())
                .andExpect(jsonPath("$.photo.s3_object_key", is("photos/user123/image001.jpg")))
                .andExpect(jsonPath("$.photo.shot_at", is("2025-08-15T18:30:00")))
                .andExpect(jsonPath("$.photo.weather").exists())
                .andExpect(jsonPath("$.spot.spot_id").exists())
                .andExpect(jsonPath("$.spot.latitude", is(35.658581)))
                .andExpect(jsonPath("$.spot.longitude", is(139.745433)))
                .andExpect(jsonPath("$.user.user_id", is(testUser.getId().intValue())))
                .andExpect(jsonPath("$.user.username", is("testuser")));
    }

    @Test
    @DisplayName("正常ケース - 既存スポット(200m以内)への写真投稿")
    void testCreatePhoto_ExistingSpot_ReturnsCreatedWithSameSpot() throws Exception {
        // 既存のスポットを作成（半径200m以内）
        Spot existingSpot = new Spot();
        existingSpot.setLatitude(new BigDecimal("35.658500"));  // 約9m離れた位置
        existingSpot.setLongitude(new BigDecimal("139.745400"));
        existingSpot.setCreatedByUserId(testUser.getId());
        existingSpot = spotRepository.save(existingSpot);

        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("同じ場所からの写真");
        request.setS3ObjectKey("photos/user123/image002.jpg");
        request.setTakenAt("2025-08-16T19:00:00Z");
        request.setLatitude(new BigDecimal("35.658581"));  // 既存スポットから約9m
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.photo.title", is("同じ場所からの写真")))
                .andExpect(jsonPath("$.spot.spot_id", is(existingSpot.getSpotId().intValue())))
                .andExpect(jsonPath("$.spot.latitude", is(35.658500)))
                .andExpect(jsonPath("$.spot.longitude", is(139.745400)));
    }

    @Test
    @DisplayName("バリデーションエラー - title必須")
    void testCreatePhoto_MissingTitle_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setS3ObjectKey("photos/user123/image003.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors", hasSize(greaterThan(0))))
                .andExpect(jsonPath("$.errors[?(@.field == 'title')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - title文字数制限(2文字未満)")
    void testCreatePhoto_TitleTooShort_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("a");  // 1文字（2文字未満）
        request.setS3ObjectKey("photos/user123/image004.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == 'title')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - title文字数制限(20文字超過)")
    void testCreatePhoto_TitleTooLong_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("あいうえおかきくけこさしすせそたちつてとな");  // 21文字
        request.setS3ObjectKey("photos/user123/image005.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == 'title')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - s3ObjectKey必須")
    void testCreatePhoto_MissingS3ObjectKey_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("テスト写真");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == 's3ObjectKey')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - takenAt必須")
    void testCreatePhoto_MissingTakenAt_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("テスト写真");
        request.setS3ObjectKey("photos/user123/image006.jpg");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == 'takenAt')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - latitude必須")
    void testCreatePhoto_MissingLatitude_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("テスト写真");
        request.setS3ObjectKey("photos/user123/image007.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == 'latitude')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - longitude必須")
    void testCreatePhoto_MissingLongitude_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("テスト写真");
        request.setS3ObjectKey("photos/user123/image008.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setCategories(List.of("風景"));

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == 'longitude')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - categories必須")
    void testCreatePhoto_MissingCategories_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("テスト写真");
        request.setS3ObjectKey("photos/user123/image009.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == 'categories')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - categories空リスト")
    void testCreatePhoto_EmptyCategories_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("テスト写真");
        request.setS3ObjectKey("photos/user123/image010.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of());  // 空リスト

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == 'categories')].message").exists());
    }

    @Test
    @DisplayName("業務エラー - 存在しないカテゴリ名が送信された場合")
    void testCreatePhoto_InvalidCategoryName_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("テスト写真");
        request.setS3ObjectKey("photos/user123/image011.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("存在しないカテゴリ"));

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("カテゴリ")));
    }

    @Test
    @DisplayName("認証エラー - 未認証ユーザーのアクセス")
    void testCreatePhoto_Unauthorized_ReturnsUnauthorized() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("テスト写真");
        request.setS3ObjectKey("photos/user123/image012.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        mockMvc.perform(post("/api/v1/photos")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("認証エラー - 無効なトークン")
    void testCreatePhoto_InvalidToken_ReturnsUnauthorized() throws Exception {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle("テスト写真");
        request.setS3ObjectKey("photos/user123/image013.jpg");
        request.setTakenAt("2025-08-15T18:30:00Z");
        request.setLatitude(new BigDecimal("35.658581"));
        request.setLongitude(new BigDecimal("139.745433"));
        request.setCategories(List.of("風景"));

        mockMvc.perform(post("/api/v1/photos")
                .header("Authorization", "Bearer invalid_token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("正常ケース - 写真詳細取得（お気に入り未登録）")
    void testGetPhotoDetail_NotFavorited_ReturnsFalse() throws Exception {
        // テスト用の写真を作成
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(testUser.getId());
        spot = spotRepository.save(spot);

        Photo photo = new Photo();
        photo.setTitle("Test Photo");
        photo.setS3ObjectKey("test/photo.jpg");
        photo.setShotAt(java.time.LocalDateTime.now());
        photo.setUserId(testUser.getId());
        photo.setSpotId(spot.getSpotId());
        photo = photoRepository.save(photo);

        // 写真詳細取得（認証あり、お気に入り未登録）
        mockMvc.perform(get("/api/v1/photos/" + photo.getPhotoId())
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photo.photo_id").value(photo.getPhotoId()))
                .andExpect(jsonPath("$.photo.title").value("Test Photo"))
                .andExpect(jsonPath("$.photo.is_favorited").value(false));
    }

    @Test
    @DisplayName("正常ケース - 写真詳細取得（お気に入り登録済み）")
    void testGetPhotoDetail_Favorited_ReturnsTrue() throws Exception {
        // テスト用の写真を作成
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(testUser.getId());
        spot = spotRepository.save(spot);

        Photo photo = new Photo();
        photo.setTitle("Test Photo");
        photo.setS3ObjectKey("test/photo.jpg");
        photo.setShotAt(java.time.LocalDateTime.now());
        photo.setUserId(testUser.getId());
        photo.setSpotId(spot.getSpotId());
        photo = photoRepository.save(photo);

        // お気に入り登録
        mockMvc.perform(post("/api/v1/photos/" + photo.getPhotoId() + "/favorite")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        // 写真詳細取得（認証あり、お気に入り登録済み）
        mockMvc.perform(get("/api/v1/photos/" + photo.getPhotoId())
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photo.photo_id").value(photo.getPhotoId()))
                .andExpect(jsonPath("$.photo.title").value("Test Photo"))
                .andExpect(jsonPath("$.photo.is_favorited").value(true));
    }

    @Test
    @DisplayName("正常ケース - 写真詳細取得（未認証ユーザー）")
    void testGetPhotoDetail_Unauthenticated_ReturnsFalse() throws Exception {
        // テスト用の写真を作成
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(testUser.getId());
        spot = spotRepository.save(spot);

        Photo photo = new Photo();
        photo.setTitle("Test Photo");
        photo.setS3ObjectKey("test/photo.jpg");
        photo.setShotAt(java.time.LocalDateTime.now());
        photo.setUserId(testUser.getId());
        photo.setSpotId(spot.getSpotId());
        photo = photoRepository.save(photo);

        // 写真詳細取得（認証なし）
        mockMvc.perform(get("/api/v1/photos/" + photo.getPhotoId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photo.photo_id").value(photo.getPhotoId()))
                .andExpect(jsonPath("$.photo.title").value("Test Photo"))
                .andExpect(jsonPath("$.photo.is_favorited").value(false));
    }

    // Issue#9: 写真アップロード処理 - 署名付きURL発行API
    @Test
    @DisplayName("Issue#9 - 正常ケース: 署名付きURL発行成功")
    void testGetUploadUrl_ValidRequest_ReturnsUploadUrl() throws Exception {
        com.photlas.backend.dto.UploadUrlRequest request =
            new com.photlas.backend.dto.UploadUrlRequest("jpg", "image/jpeg");

        mockMvc.perform(post("/api/v1/photos/upload-url")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uploadUrl").exists())
                .andExpect(jsonPath("$.uploadUrl").isString())
                .andExpect(jsonPath("$.objectKey").exists())
                .andExpect(jsonPath("$.objectKey").value(startsWith("uploads/" + testUser.getId())));
    }

    @Test
    @DisplayName("Issue#9 - 認証エラー: 未認証ユーザーのアクセス")
    void testGetUploadUrl_Unauthorized_ReturnsUnauthorized() throws Exception {
        com.photlas.backend.dto.UploadUrlRequest request =
            new com.photlas.backend.dto.UploadUrlRequest("jpg", "image/jpeg");

        mockMvc.perform(post("/api/v1/photos/upload-url")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Issue#9 - バリデーションエラー: extension必須")
    void testGetUploadUrl_MissingExtension_ReturnsBadRequest() throws Exception {
        com.photlas.backend.dto.UploadUrlRequest request =
            new com.photlas.backend.dto.UploadUrlRequest(null, "image/jpeg");

        mockMvc.perform(post("/api/v1/photos/upload-url")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#9 - バリデーションエラー: contentType必須")
    void testGetUploadUrl_MissingContentType_ReturnsBadRequest() throws Exception {
        com.photlas.backend.dto.UploadUrlRequest request =
            new com.photlas.backend.dto.UploadUrlRequest("jpg", null);

        mockMvc.perform(post("/api/v1/photos/upload-url")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
