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
import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
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

    // テストデータ定数 - ユーザー情報
    private static final String TEST_USERNAME = "testuser";
    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_PASSWORD_HASH = "hashedpassword";
    private static final String USER_ROLE = "USER";

    // テストデータ定数 - カテゴリ
    private static final String CATEGORY_LANDSCAPE = "風景";
    private static final String CATEGORY_CITYSCAPE = "都市・街並み";
    private static final String CATEGORY_ARCHITECTURE = "建築";
    private static final String CATEGORY_INVALID = "存在しないカテゴリ";

    // テストデータ定数 - エンドポイント
    private static final String ENDPOINT_PHOTOS = "/api/v1/photos";
    private static final String ENDPOINT_UPLOAD_URL = "/api/v1/photos/upload-url";
    private static final String ENDPOINT_PHOTO_DETAIL = "/api/v1/photos/";
    private static final String ENDPOINT_FAVORITE = "/favorite";

    // テストデータ定数 - JSONPath
    private static final String JSON_PATH_PHOTO_TITLE = "$.photo.title";
    private static final String JSON_PATH_PHOTO_ID = "$.photo.photo_id";
    private static final String JSON_PATH_PHOTO_S3_KEY = "$.photo.s3_object_key";
    private static final String JSON_PATH_PHOTO_SHOT_AT = "$.photo.shot_at";
    private static final String JSON_PATH_PHOTO_WEATHER = "$.photo.weather";
    private static final String JSON_PATH_PHOTO_IS_FAVORITED = "$.photo.is_favorited";
    private static final String JSON_PATH_SPOT_ID = "$.spot.spot_id";
    private static final String JSON_PATH_SPOT_LATITUDE = "$.spot.latitude";
    private static final String JSON_PATH_SPOT_LONGITUDE = "$.spot.longitude";
    private static final String JSON_PATH_USER_ID = "$.user.user_id";
    private static final String JSON_PATH_USER_USERNAME = "$.user.username";
    private static final String JSON_PATH_ERRORS = "$.errors";
    private static final String JSON_PATH_MESSAGE = "$.message";
    private static final String JSON_PATH_UPLOAD_URL = "$.uploadUrl";
    private static final String JSON_PATH_OBJECT_KEY = "$.objectKey";

    // テストデータ定数 - S3関連
    private static final String S3_OBJECT_KEY_TEST = "test/photo.jpg";
    private static final String S3_OBJECT_KEY_PREFIX = "photos/user123/image";
    private static final String S3_FOLDER_UPLOADS = "uploads";
    private static final String S3_EXTENSION_JPG = "jpg";
    private static final String S3_CONTENT_TYPE_JPEG = "image/jpeg";
    private static final String S3_PRESIGNED_URL_BASE = "https://test-bucket.s3.us-east-1.amazonaws.com/";
    private static final String S3_PRESIGNED_URL_SUFFIX = "?signature=test";

    // テストデータ定数 - 写真情報
    private static final String PHOTO_TITLE_TOKYO_TOWER = "東京タワーの夜景";
    private static final String PHOTO_TITLE_SAME_LOCATION = "同じ場所からの写真";
    private static final String PHOTO_TITLE_TEST = "テスト写真";
    private static final String PHOTO_TITLE_TEST_EN = "Test Photo";
    private static final String PHOTO_TITLE_SHORT = "a";
    private static final String PHOTO_TITLE_TOO_LONG = "あいうえおかきくけこさしすせそたちつてとな"; // 21文字

    // テストデータ定数 - 日時
    private static final String ISO_DATETIME_1 = "2025-08-15T18:30:00Z";
    private static final String ISO_DATETIME_2 = "2025-08-16T19:00:00Z";
    private static final String FORMATTED_DATETIME_1 = "2025-08-15T18:30:00";

    // テストデータ定数 - 座標（東京タワー付近）
    private static final BigDecimal LATITUDE_TOKYO_TOWER = new BigDecimal("35.658581");
    private static final BigDecimal LONGITUDE_TOKYO_TOWER = new BigDecimal("139.745433");
    private static final BigDecimal LATITUDE_NEARBY = new BigDecimal("35.658500");
    private static final BigDecimal LONGITUDE_NEARBY = new BigDecimal("139.745400");

    // テストデータ定数 - フィールド名
    private static final String FIELD_TITLE = "title";
    private static final String FIELD_S3_OBJECT_KEY = "s3ObjectKey";
    private static final String FIELD_TAKEN_AT = "takenAt";
    private static final String FIELD_LATITUDE = "latitude";
    private static final String FIELD_LONGITUDE = "longitude";
    private static final String FIELD_CATEGORIES = "categories";

    // テストデータ定数 - 認証
    private static final String HEADER_AUTHORIZATION = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String INVALID_TOKEN = "invalid_token";

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
        testUser = createTestUser();

        // JWTトークンを生成
        token = jwtService.generateToken(testUser.getEmail());

        // カテゴリマスターデータを作成
        createCategory(CATEGORY_LANDSCAPE);
        createCategory(CATEGORY_CITYSCAPE);
        createCategory(CATEGORY_ARCHITECTURE);

        // S3Serviceのモック設定
        setupS3ServiceMock();
    }

    /**
     * テスト用のUserを作成するヘルパーメソッド
     */
    private User createTestUser() {
        User user = new User();
        user.setUsername(TEST_USERNAME);
        user.setEmail(TEST_EMAIL);
        user.setPasswordHash(TEST_PASSWORD_HASH);
        user.setRole(USER_ROLE);
        return userRepository.save(user);
    }

    /**
     * カテゴリを作成するヘルパーメソッド
     */
    private Category createCategory(String name) {
        Category category = new Category();
        category.setName(name);
        return categoryRepository.save(category);
    }

    /**
     * テスト用のSpotを作成するヘルパーメソッド
     */
    private Spot createSpot(BigDecimal latitude, BigDecimal longitude) {
        Spot spot = new Spot();
        spot.setLatitude(latitude);
        spot.setLongitude(longitude);
        spot.setCreatedByUserId(testUser.getId());
        return spotRepository.save(spot);
    }

    /**
     * テスト用のPhotoを作成するヘルパーメソッド
     */
    private Photo createPhoto(String title, String s3ObjectKey, Long spotId) {
        Photo photo = new Photo();
        photo.setTitle(title);
        photo.setS3ObjectKey(s3ObjectKey);
        photo.setShotAt(LocalDateTime.now());
        photo.setUserId(testUser.getId());
        photo.setSpotId(spotId);
        return photoRepository.save(photo);
    }

    /**
     * CreatePhotoRequestを作成するヘルパーメソッド
     */
    private CreatePhotoRequest createPhotoRequest(String title, String s3ObjectKey, String takenAt,
                                                   BigDecimal latitude, BigDecimal longitude,
                                                   List<String> categories) {
        CreatePhotoRequest request = new CreatePhotoRequest();
        request.setTitle(title);
        request.setS3ObjectKey(s3ObjectKey);
        request.setTakenAt(takenAt);
        request.setLatitude(latitude);
        request.setLongitude(longitude);
        request.setCategories(categories);
        return request;
    }

    /**
     * S3サービスのモックをセットアップするヘルパーメソッド
     */
    private void setupS3ServiceMock() {
        when(s3Service.generatePresignedUploadUrl(anyString(), anyLong(), anyString(), anyString()))
                .thenAnswer(invocation -> {
                    String folder = invocation.getArgument(0);
                    Long userId = invocation.getArgument(1);
                    String extension = invocation.getArgument(2);
                    String objectKey = String.format("%s/%d/test-uuid.%s", folder, userId, extension);
                    String uploadUrl = S3_PRESIGNED_URL_BASE + objectKey + S3_PRESIGNED_URL_SUFFIX;
                    return new S3Service.UploadUrlResult(uploadUrl, objectKey);
                });
    }

    @Test
    @DisplayName("正常ケース - 新規スポット作成を伴う写真投稿")
    void testCreatePhoto_NewSpot_ReturnsCreatedWithPhotoData() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_TOKYO_TOWER,
                S3_OBJECT_KEY_PREFIX + "001.jpg",
                ISO_DATETIME_1,
                LATITUDE_TOKYO_TOWER,
                LONGITUDE_TOKYO_TOWER,
                List.of(CATEGORY_LANDSCAPE, CATEGORY_CITYSCAPE)
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath(JSON_PATH_PHOTO_TITLE, is(PHOTO_TITLE_TOKYO_TOWER)))
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).exists())
                .andExpect(jsonPath(JSON_PATH_PHOTO_S3_KEY, is(S3_OBJECT_KEY_PREFIX + "001.jpg")))
                .andExpect(jsonPath(JSON_PATH_PHOTO_SHOT_AT, is(FORMATTED_DATETIME_1)))
                .andExpect(jsonPath(JSON_PATH_PHOTO_WEATHER).exists())
                .andExpect(jsonPath(JSON_PATH_SPOT_ID).exists())
                .andExpect(jsonPath(JSON_PATH_SPOT_LATITUDE, is(35.658581)))
                .andExpect(jsonPath(JSON_PATH_SPOT_LONGITUDE, is(139.745433)))
                .andExpect(jsonPath(JSON_PATH_USER_ID, is(testUser.getId().intValue())))
                .andExpect(jsonPath(JSON_PATH_USER_USERNAME, is(TEST_USERNAME)));
    }

    @Test
    @DisplayName("正常ケース - 既存スポット(200m以内)への写真投稿")
    void testCreatePhoto_ExistingSpot_ReturnsCreatedWithSameSpot() throws Exception {
        // 既存のスポットを作成（半径200m以内）
        Spot existingSpot = createSpot(LATITUDE_NEARBY, LONGITUDE_NEARBY);

        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_SAME_LOCATION,
                S3_OBJECT_KEY_PREFIX + "002.jpg",
                ISO_DATETIME_2,
                LATITUDE_TOKYO_TOWER,
                LONGITUDE_TOKYO_TOWER,
                List.of(CATEGORY_LANDSCAPE)
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath(JSON_PATH_PHOTO_TITLE, is(PHOTO_TITLE_SAME_LOCATION)))
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(existingSpot.getSpotId().intValue())))
                .andExpect(jsonPath(JSON_PATH_SPOT_LATITUDE, is(35.658500)))
                .andExpect(jsonPath(JSON_PATH_SPOT_LONGITUDE, is(139.745400)));
    }

    @Test
    @DisplayName("バリデーションエラー - title必須")
    void testCreatePhoto_MissingTitle_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                null,
                S3_OBJECT_KEY_PREFIX + "003.jpg",
                ISO_DATETIME_1,
                LATITUDE_TOKYO_TOWER,
                LONGITUDE_TOKYO_TOWER,
                List.of(CATEGORY_LANDSCAPE)
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_ERRORS, hasSize(greaterThan(0))))
                .andExpect(jsonPath("$.errors[?(@.field == '" + FIELD_TITLE + "')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - title文字数制限(2文字未満)")
    void testCreatePhoto_TitleTooShort_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_SHORT,
                S3_OBJECT_KEY_PREFIX + "004.jpg",
                ISO_DATETIME_1,
                LATITUDE_TOKYO_TOWER,
                LONGITUDE_TOKYO_TOWER,
                List.of(CATEGORY_LANDSCAPE)
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == '" + FIELD_TITLE + "')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - title文字数制限(20文字超過)")
    void testCreatePhoto_TitleTooLong_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_TOO_LONG,
                S3_OBJECT_KEY_PREFIX + "005.jpg",
                ISO_DATETIME_1,
                LATITUDE_TOKYO_TOWER,
                LONGITUDE_TOKYO_TOWER,
                List.of(CATEGORY_LANDSCAPE)
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == '" + FIELD_TITLE + "')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - s3ObjectKey必須")
    void testCreatePhoto_MissingS3ObjectKey_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_TEST,
                null,
                ISO_DATETIME_1,
                LATITUDE_TOKYO_TOWER,
                LONGITUDE_TOKYO_TOWER,
                List.of(CATEGORY_LANDSCAPE)
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == '" + FIELD_S3_OBJECT_KEY + "')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - takenAt必須")
    void testCreatePhoto_MissingTakenAt_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_TEST,
                S3_OBJECT_KEY_PREFIX + "006.jpg",
                null,
                LATITUDE_TOKYO_TOWER,
                LONGITUDE_TOKYO_TOWER,
                List.of(CATEGORY_LANDSCAPE)
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == '" + FIELD_TAKEN_AT + "')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - latitude必須")
    void testCreatePhoto_MissingLatitude_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_TEST,
                S3_OBJECT_KEY_PREFIX + "007.jpg",
                ISO_DATETIME_1,
                null,
                LONGITUDE_TOKYO_TOWER,
                List.of(CATEGORY_LANDSCAPE)
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == '" + FIELD_LATITUDE + "')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - longitude必須")
    void testCreatePhoto_MissingLongitude_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_TEST,
                S3_OBJECT_KEY_PREFIX + "008.jpg",
                ISO_DATETIME_1,
                LATITUDE_TOKYO_TOWER,
                null,
                List.of(CATEGORY_LANDSCAPE)
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == '" + FIELD_LONGITUDE + "')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - categories必須")
    void testCreatePhoto_MissingCategories_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_TEST,
                S3_OBJECT_KEY_PREFIX + "009.jpg",
                ISO_DATETIME_1,
                LATITUDE_TOKYO_TOWER,
                LONGITUDE_TOKYO_TOWER,
                null
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == '" + FIELD_CATEGORIES + "')].message").exists());
    }

    @Test
    @DisplayName("バリデーションエラー - categories空リスト")
    void testCreatePhoto_EmptyCategories_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_TEST,
                S3_OBJECT_KEY_PREFIX + "010.jpg",
                ISO_DATETIME_1,
                LATITUDE_TOKYO_TOWER,
                LONGITUDE_TOKYO_TOWER,
                List.of()
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.field == '" + FIELD_CATEGORIES + "')].message").exists());
    }

    @Test
    @DisplayName("業務エラー - 存在しないカテゴリ名が送信された場合")
    void testCreatePhoto_InvalidCategoryName_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_TEST,
                S3_OBJECT_KEY_PREFIX + "011.jpg",
                ISO_DATETIME_1,
                LATITUDE_TOKYO_TOWER,
                LONGITUDE_TOKYO_TOWER,
                List.of(CATEGORY_INVALID)
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath(JSON_PATH_MESSAGE, containsString("カテゴリ")));
    }

    @Test
    @DisplayName("認証エラー - 未認証ユーザーのアクセス")
    void testCreatePhoto_Unauthorized_ReturnsUnauthorized() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_TEST,
                S3_OBJECT_KEY_PREFIX + "012.jpg",
                ISO_DATETIME_1,
                LATITUDE_TOKYO_TOWER,
                LONGITUDE_TOKYO_TOWER,
                List.of(CATEGORY_LANDSCAPE)
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("認証エラー - 無効なトークン")
    void testCreatePhoto_InvalidToken_ReturnsUnauthorized() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                PHOTO_TITLE_TEST,
                S3_OBJECT_KEY_PREFIX + "013.jpg",
                ISO_DATETIME_1,
                LATITUDE_TOKYO_TOWER,
                LONGITUDE_TOKYO_TOWER,
                List.of(CATEGORY_LANDSCAPE)
        );

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + INVALID_TOKEN)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("正常ケース - 写真詳細取得（お気に入り未登録）")
    void testGetPhotoDetail_NotFavorited_ReturnsFalse() throws Exception {
        // テスト用の写真を作成
        Spot spot = createSpot(LATITUDE_TOKYO_TOWER, LONGITUDE_TOKYO_TOWER);
        Photo photo = createPhoto(PHOTO_TITLE_TEST_EN, S3_OBJECT_KEY_TEST, spot.getSpotId());

        // 写真詳細取得（認証あり、お気に入り未登録）
        mockMvc.perform(get(ENDPOINT_PHOTO_DETAIL + photo.getPhotoId())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).value(photo.getPhotoId()))
                .andExpect(jsonPath(JSON_PATH_PHOTO_TITLE).value(PHOTO_TITLE_TEST_EN))
                .andExpect(jsonPath(JSON_PATH_PHOTO_IS_FAVORITED).value(false));
    }

    @Test
    @DisplayName("正常ケース - 写真詳細取得（お気に入り登録済み）")
    void testGetPhotoDetail_Favorited_ReturnsTrue() throws Exception {
        // テスト用の写真を作成
        Spot spot = createSpot(LATITUDE_TOKYO_TOWER, LONGITUDE_TOKYO_TOWER);
        Photo photo = createPhoto(PHOTO_TITLE_TEST_EN, S3_OBJECT_KEY_TEST, spot.getSpotId());

        // お気に入り登録
        mockMvc.perform(post(ENDPOINT_PHOTO_DETAIL + photo.getPhotoId() + ENDPOINT_FAVORITE)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token))
                .andExpect(status().isNoContent());

        // 写真詳細取得（認証あり、お気に入り登録済み）
        mockMvc.perform(get(ENDPOINT_PHOTO_DETAIL + photo.getPhotoId())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).value(photo.getPhotoId()))
                .andExpect(jsonPath(JSON_PATH_PHOTO_TITLE).value(PHOTO_TITLE_TEST_EN))
                .andExpect(jsonPath(JSON_PATH_PHOTO_IS_FAVORITED).value(true));
    }

    @Test
    @DisplayName("正常ケース - 写真詳細取得（未認証ユーザー）")
    void testGetPhotoDetail_Unauthenticated_ReturnsFalse() throws Exception {
        // テスト用の写真を作成
        Spot spot = createSpot(LATITUDE_TOKYO_TOWER, LONGITUDE_TOKYO_TOWER);
        Photo photo = createPhoto(PHOTO_TITLE_TEST_EN, S3_OBJECT_KEY_TEST, spot.getSpotId());

        // 写真詳細取得（認証なし）
        mockMvc.perform(get(ENDPOINT_PHOTO_DETAIL + photo.getPhotoId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).value(photo.getPhotoId()))
                .andExpect(jsonPath(JSON_PATH_PHOTO_TITLE).value(PHOTO_TITLE_TEST_EN))
                .andExpect(jsonPath(JSON_PATH_PHOTO_IS_FAVORITED).value(false));
    }

    // Issue#9: 写真アップロード処理 - 署名付きURL発行API
    @Test
    @DisplayName("Issue#9 - 正常ケース: 署名付きURL発行成功")
    void testGetUploadUrl_ValidRequest_ReturnsUploadUrl() throws Exception {
        com.photlas.backend.dto.UploadUrlRequest request =
            new com.photlas.backend.dto.UploadUrlRequest(S3_EXTENSION_JPG, S3_CONTENT_TYPE_JPEG);

        mockMvc.perform(post(ENDPOINT_UPLOAD_URL)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_UPLOAD_URL).exists())
                .andExpect(jsonPath(JSON_PATH_UPLOAD_URL).isString())
                .andExpect(jsonPath(JSON_PATH_OBJECT_KEY).exists())
                .andExpect(jsonPath(JSON_PATH_OBJECT_KEY).value(startsWith(S3_FOLDER_UPLOADS + "/" + testUser.getId())));
    }

    @Test
    @DisplayName("Issue#9 - 認証エラー: 未認証ユーザーのアクセス")
    void testGetUploadUrl_Unauthorized_ReturnsUnauthorized() throws Exception {
        com.photlas.backend.dto.UploadUrlRequest request =
            new com.photlas.backend.dto.UploadUrlRequest(S3_EXTENSION_JPG, S3_CONTENT_TYPE_JPEG);

        mockMvc.perform(post(ENDPOINT_UPLOAD_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Issue#9 - バリデーションエラー: extension必須")
    void testGetUploadUrl_MissingExtension_ReturnsBadRequest() throws Exception {
        com.photlas.backend.dto.UploadUrlRequest request =
            new com.photlas.backend.dto.UploadUrlRequest(null, S3_CONTENT_TYPE_JPEG);

        mockMvc.perform(post(ENDPOINT_UPLOAD_URL)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#9 - バリデーションエラー: contentType必須")
    void testGetUploadUrl_MissingContentType_ReturnsBadRequest() throws Exception {
        com.photlas.backend.dto.UploadUrlRequest request =
            new com.photlas.backend.dto.UploadUrlRequest(S3_EXTENSION_JPG, null);

        mockMvc.perform(post(ENDPOINT_UPLOAD_URL)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
