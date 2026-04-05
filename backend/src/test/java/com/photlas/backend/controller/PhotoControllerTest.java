package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
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
    private static final String JSON_PATH_PHOTO_ID = "$.photo.photo_id";
    private static final String JSON_PATH_PHOTO_IMAGE_URL = "$.photo.image_url";
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
    private static final String S3_OBJECT_KEY_TEST = "uploads/1/00000000-0000-0000-0000-000000000000.jpg";
    private static final String S3_OBJECT_KEY_PREFIX = "uploads/1/00000000-0000-0000-0000-00000000";
    private static final String S3_FOLDER_UPLOADS = "uploads";
    private static final String S3_EXTENSION_JPG = "jpg";
    private static final String S3_CONTENT_TYPE_JPEG = "image/jpeg";
    private static final String S3_PRESIGNED_URL_BASE = "https://test-bucket.s3.us-east-1.amazonaws.com/";
    private static final String S3_PRESIGNED_URL_SUFFIX = "?signature=test";

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
        createCategory(CodeConstants.CATEGORY_NATURE, CATEGORY_LANDSCAPE);
        createCategory(CodeConstants.CATEGORY_CITYSCAPE, CATEGORY_CITYSCAPE);
        createCategory(CodeConstants.CATEGORY_ARCHITECTURE, CATEGORY_ARCHITECTURE);

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
        user.setRole(CodeConstants.ROLE_USER);
        return userRepository.save(user);
    }

    /**
     * カテゴリを作成するヘルパーメソッド
     */
    private Category createCategory(int categoryId, String name) {
        Category category = new Category();
        category.setCategoryId(categoryId);
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
    private Photo createPhoto(String s3ObjectKey, Long spotId) {
        Photo photo = new Photo();
        photo.setS3ObjectKey(s3ObjectKey);
        photo.setShotAt(LocalDateTime.now());
        photo.setUserId(testUser.getId());
        photo.setSpotId(spotId);
        photo.setModerationStatus(com.photlas.backend.entity.CodeConstants.MODERATION_STATUS_PUBLISHED);
        return photoRepository.save(photo);
    }

    /**
     * CreatePhotoRequestを作成するヘルパーメソッド
     */
    private CreatePhotoRequest createPhotoRequest(String s3ObjectKey, String takenAt,
                                                   BigDecimal latitude, BigDecimal longitude,
                                                   List<String> categories) {
        CreatePhotoRequest request = new CreatePhotoRequest();
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

        // CDN URL生成のモック（s3ObjectKeyをそのままURLに含める）
        when(s3Service.generateCdnUrl(anyString()))
                .thenAnswer(invocation -> {
                    String s3ObjectKey = invocation.getArgument(0);
                    return S3_PRESIGNED_URL_BASE + s3ObjectKey;
                });
    }

    @Test
    @DisplayName("正常ケース - 新規スポット作成を伴う写真投稿")
    void testCreatePhoto_NewSpot_ReturnsCreatedWithPhotoData() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
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
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).exists())
                .andExpect(jsonPath(JSON_PATH_PHOTO_IMAGE_URL, containsString(S3_OBJECT_KEY_PREFIX + "001.jpg")))
                .andExpect(jsonPath(JSON_PATH_PHOTO_SHOT_AT, is(FORMATTED_DATETIME_1)))
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
                .andExpect(jsonPath(JSON_PATH_SPOT_ID, is(existingSpot.getSpotId().intValue())))
                .andExpect(jsonPath(JSON_PATH_SPOT_LATITUDE, is(35.658500)))
                .andExpect(jsonPath(JSON_PATH_SPOT_LONGITUDE, is(139.745400)));
    }

    @Test
    @DisplayName("正常ケース - 最小限のフィールドで写真投稿")
    void testCreatePhoto_NullTitle_ReturnsCreated() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
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
                .andExpect(status().isCreated())
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).exists())
                .andExpect(jsonPath(JSON_PATH_SPOT_ID).exists());
    }

    @Test
    @DisplayName("バリデーションエラー - s3ObjectKey必須")
    void testCreatePhoto_MissingS3ObjectKey_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
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

    // Issue#48: categories は任意項目に変更されたため、null/空リストの
    // バリデーションエラーテストは Issue#48 の正常系テストに置き換え済み

    @Test
    @DisplayName("業務エラー - 存在しないカテゴリ名が送信された場合")
    void testCreatePhoto_InvalidCategoryName_ReturnsBadRequest() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
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
        Photo photo = createPhoto(S3_OBJECT_KEY_TEST, spot.getSpotId());

        // 写真詳細取得（認証あり、お気に入り未登録）
        mockMvc.perform(get(ENDPOINT_PHOTO_DETAIL + photo.getPhotoId())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).value(photo.getPhotoId()))
                .andExpect(jsonPath(JSON_PATH_PHOTO_IS_FAVORITED).value(false));
    }

    @Test
    @DisplayName("正常ケース - 写真詳細取得（お気に入り登録済み）")
    void testGetPhotoDetail_Favorited_ReturnsTrue() throws Exception {
        // テスト用の写真を作成
        Spot spot = createSpot(LATITUDE_TOKYO_TOWER, LONGITUDE_TOKYO_TOWER);
        Photo photo = createPhoto(S3_OBJECT_KEY_TEST, spot.getSpotId());

        // お気に入り登録（Issue#30: 201 Created を返す）
        mockMvc.perform(post(ENDPOINT_PHOTO_DETAIL + photo.getPhotoId() + ENDPOINT_FAVORITE)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token))
                .andExpect(status().isCreated());

        // 写真詳細取得（認証あり、お気に入り登録済み）
        mockMvc.perform(get(ENDPOINT_PHOTO_DETAIL + photo.getPhotoId())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).value(photo.getPhotoId()))
                .andExpect(jsonPath(JSON_PATH_PHOTO_IS_FAVORITED).value(true));
    }

    @Test
    @DisplayName("正常ケース - 写真詳細取得（未認証ユーザー）")
    void testGetPhotoDetail_Unauthenticated_ReturnsFalse() throws Exception {
        // テスト用の写真を作成
        Spot spot = createSpot(LATITUDE_TOKYO_TOWER, LONGITUDE_TOKYO_TOWER);
        Photo photo = createPhoto(S3_OBJECT_KEY_TEST, spot.getSpotId());

        // 写真詳細取得（認証なし）
        mockMvc.perform(get(ENDPOINT_PHOTO_DETAIL + photo.getPhotoId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).value(photo.getPhotoId()))
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

    // ===== Issue#48: カテゴリ任意化テスト =====

    @Test
    @DisplayName("Issue#48 - カテゴリ空リストでの投稿が201を返す")
    void testCreatePhoto_EmptyCategories_ReturnsCreated() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                "uploads/1/b0000000-0000-0000-0000-000000000001.jpg",
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
                .andExpect(status().isCreated())
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).exists())
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).exists());
    }

    @Test
    @DisplayName("Issue#48 - カテゴリnullでの投稿が201を返す")
    void testCreatePhoto_NullCategories_ReturnsCreated() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                "uploads/1/b0000000-0000-0000-0000-000000000002.jpg",
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
                .andExpect(status().isCreated())
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).exists());
    }

    // ===== Issue#40: Photo Entity拡張テスト =====

    @Test
    @DisplayName("Issue#40 - EXIF情報付き写真投稿でレスポンスにEXIFオブジェクトが含まれる")
    void testCreatePhoto_WithExif_ReturnsExifInResponse() throws Exception {
        String requestJson = """
                {
                    "s3ObjectKey": "uploads/1/a0000000-0000-0000-0000-000000000001.jpg",
                    "takenAt": "2026-01-15T17:30:00Z",
                    "latitude": 35.658581,
                    "longitude": 139.745433,
                    "categories": ["風景"],
                    "cameraBody": "Canon EOS R5",
                    "cameraLens": "RF 24-70mm f/2.8L",
                    "focalLength35mm": 35,
                    "fValue": "f/2.8",
                    "shutterSpeed": "1/1000",
                    "iso": 400,
                    "imageWidth": 8192,
                    "imageHeight": 5464
                }
                """;

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.photo.photo_id").exists())
                .andExpect(jsonPath("$.photo.exif.camera_body", is("Canon EOS R5")))
                .andExpect(jsonPath("$.photo.exif.camera_lens", is("RF 24-70mm f/2.8L")))
                .andExpect(jsonPath("$.photo.exif.focal_length_35mm", is(35)))
                .andExpect(jsonPath("$.photo.exif.f_value", is("f/2.8")))
                .andExpect(jsonPath("$.photo.exif.shutter_speed", is("1/1000")))
                .andExpect(jsonPath("$.photo.exif.iso", is(400)))
                .andExpect(jsonPath("$.photo.exif.image_width", is(8192)))
                .andExpect(jsonPath("$.photo.exif.image_height", is(5464)));
    }

    @Test
    @DisplayName("Issue#40 - EXIF情報なしの投稿でexifフィールドがnull")
    void testCreatePhoto_WithoutExif_ExifIsNull() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                "uploads/1/b0000000-0000-0000-0000-000000000003.jpg",
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
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.photo.exif").doesNotExist());
    }

    @Test
    @DisplayName("Issue#40 - 写真詳細取得でEXIFオブジェクトとピンポイント座標が返される")
    void testGetPhotoDetail_ReturnsExifAndCoordinates() throws Exception {
        Spot spot = createSpot(LATITUDE_TOKYO_TOWER, LONGITUDE_TOKYO_TOWER);

        Photo photo = new Photo();
        photo.setS3ObjectKey("photos/exif-detail-api001.jpg");
        photo.setShotAt(LocalDateTime.of(2026, 1, 15, 17, 30));
        photo.setWeather(CodeConstants.WEATHER_SUNNY);
        photo.setUserId(testUser.getId());
        photo.setSpotId(spot.getSpotId());
        photo.setLatitude(new BigDecimal("35.658600"));
        photo.setLongitude(new BigDecimal("139.745450"));
        photo.setCameraBody("Nikon Z9");
        photo.setFocalLength35mm(70);
        photo.setIso(800);
        photo.setImageWidth(8256);
        photo.setImageHeight(5504);
        photo = photoRepository.save(photo);

        mockMvc.perform(get(ENDPOINT_PHOTO_DETAIL + photo.getPhotoId())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photo.latitude", is(35.658600)))
                .andExpect(jsonPath("$.photo.longitude", is(139.745450)))
                .andExpect(jsonPath("$.photo.exif.camera_body", is("Nikon Z9")))
                .andExpect(jsonPath("$.photo.exif.focal_length_35mm", is(70)))
                .andExpect(jsonPath("$.photo.exif.iso", is(800)))
                .andExpect(jsonPath("$.photo.exif.image_width", is(8256)))
                .andExpect(jsonPath("$.photo.exif.image_height", is(5504)));
    }

    // ===== Issue#49: クロップ（トリミング）データ コントローラーテスト =====

    @Test
    @DisplayName("Issue#49 - クロップデータ付き写真投稿でレスポンスにクロップ情報が含まれる")
    void testCreatePhoto_WithCropData_ReturnsCropInResponse() throws Exception {
        String requestJson = """
                {
                    "s3ObjectKey": "uploads/1/a0000000-0000-0000-0000-000000000002.jpg",
                    "takenAt": "2026-02-08T10:00:00Z",
                    "latitude": 35.658581,
                    "longitude": 139.745433,
                    "cropCenterX": 0.3,
                    "cropCenterY": 0.7,
                    "cropZoom": 1.5
                }
                """;

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.photo.crop_center_x", is(0.3)))
                .andExpect(jsonPath("$.photo.crop_center_y", is(0.7)))
                .andExpect(jsonPath("$.photo.crop_zoom", is(1.5)));
    }

    @Test
    @DisplayName("Issue#49 - クロップデータなし投稿でcropフィールドがレスポンスに含まれない")
    void testCreatePhoto_WithoutCropData_CropNotInResponse() throws Exception {
        CreatePhotoRequest request = createPhotoRequest(
                "uploads/1/b0000000-0000-0000-0000-000000000004.jpg",
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
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.photo.crop_center_x").doesNotExist())
                .andExpect(jsonPath("$.photo.crop_center_y").doesNotExist())
                .andExpect(jsonPath("$.photo.crop_zoom").doesNotExist());
    }

    @Test
    @DisplayName("Issue#49 - 写真詳細取得でクロップデータが返される")
    void testGetPhotoDetail_ReturnsCropData() throws Exception {
        Spot spot = createSpot(LATITUDE_TOKYO_TOWER, LONGITUDE_TOKYO_TOWER);

        Photo photo = new Photo();
        photo.setS3ObjectKey("photos/crop-detail-api001.jpg");
        photo.setShotAt(LocalDateTime.of(2026, 2, 8, 10, 0));
        photo.setWeather(CodeConstants.WEATHER_SUNNY);
        photo.setUserId(testUser.getId());
        photo.setSpotId(spot.getSpotId());
        photo.setCropCenterX(0.4);
        photo.setCropCenterY(0.6);
        photo.setCropZoom(2.0);
        photo = photoRepository.save(photo);

        mockMvc.perform(get(ENDPOINT_PHOTO_DETAIL + photo.getPhotoId())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photo.crop_center_x", is(0.4)))
                .andExpect(jsonPath("$.photo.crop_center_y", is(0.6)))
                .andExpect(jsonPath("$.photo.crop_zoom", is(2.0)));
    }

    // ===== 署名付きURL追加バリデーションテスト =====

    @Test
    @DisplayName("Issue#9 - バリデーションエラー: 対応していないファイル拡張子（gif）")
    void testGetUploadUrl_UnsupportedExtension_ReturnsBadRequest() throws Exception {
        com.photlas.backend.dto.UploadUrlRequest request =
            new com.photlas.backend.dto.UploadUrlRequest("gif", S3_CONTENT_TYPE_JPEG);

        mockMvc.perform(post(ENDPOINT_UPLOAD_URL)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#9 - バリデーションエラー: 対応していないcontentType（image/gif）")
    void testGetUploadUrl_UnsupportedContentType_ReturnsBadRequest() throws Exception {
        com.photlas.backend.dto.UploadUrlRequest request =
            new com.photlas.backend.dto.UploadUrlRequest(S3_EXTENSION_JPG, "image/gif");

        mockMvc.perform(post(ENDPOINT_UPLOAD_URL)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ===== Issue#54: 写真ステータス取得エンドポイントテスト =====

    @Test
    @DisplayName("Issue#54 - 正常ケース: オーナーが写真のモデレーションステータスを取得")
    void testGetPhotoStatus_Owner_ReturnsStatus() throws Exception {
        Spot spot = createSpot(LATITUDE_TOKYO_TOWER, LONGITUDE_TOKYO_TOWER);
        Photo photo = createPhoto("photos/status-api001.jpg", spot.getSpotId());

        mockMvc.perform(get(ENDPOINT_PHOTO_DETAIL + photo.getPhotoId() + "/status")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.photo_id", is(photo.getPhotoId().toString())))
                .andExpect(jsonPath("$.moderation_status", is(CodeConstants.MODERATION_STATUS_PUBLISHED)));
    }

    @Test
    @DisplayName("Issue#54 - エラー: 未認証でステータス取得すると401を返す")
    void testGetPhotoStatus_Unauthenticated_ReturnsUnauthorized() throws Exception {
        Spot spot = createSpot(LATITUDE_TOKYO_TOWER, LONGITUDE_TOKYO_TOWER);
        Photo photo = createPhoto("photos/status-unauth001.jpg", spot.getSpotId());

        mockMvc.perform(get(ENDPOINT_PHOTO_DETAIL + photo.getPhotoId() + "/status"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Issue#54 - エラー: 存在しない写真IDのステータス取得")
    void testGetPhotoStatus_NonExistentPhoto_ReturnsNotFound() throws Exception {
        mockMvc.perform(get(ENDPOINT_PHOTO_DETAIL + "99999/status")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token))
                .andExpect(status().isNotFound());
    }

    // ===== 写真詳細: 存在しない写真テスト =====

    @Test
    @DisplayName("写真詳細取得 - 存在しないphotoIdは404を返す")
    void testGetPhotoDetail_NonExistentPhoto_ReturnsNotFound() throws Exception {
        mockMvc.perform(get(ENDPOINT_PHOTO_DETAIL + "99999")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token))
                .andExpect(status().isNotFound());
    }

    // ===== バリデーションエラー: placeName文字数制限テスト =====

    @Test
    @DisplayName("バリデーションエラー - placeName文字数制限（100文字超過）")
    void testCreatePhoto_PlaceNameTooLong_ReturnsBadRequest() throws Exception {
        String longPlaceName = "あ".repeat(101);
        String requestJson = String.format("""
                {
                    "placeName": "%s",
                    "s3ObjectKey": "uploads/1/a0000000-0000-0000-0000-000000000003.jpg",
                    "takenAt": "2026-01-15T10:00:00Z",
                    "latitude": 35.658581,
                    "longitude": 139.745433,
                    "categories": ["風景"]
                }
                """, longPlaceName);

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    // ===== バリデーションエラー: 緯度経度の範囲チェックテスト =====

    @Test
    @DisplayName("セキュリティ - 緯度が範囲外（91.0）の場合400エラー")
    void testCreatePhoto_LatitudeTooHigh_ReturnsBadRequest() throws Exception {
        String requestJson = """
                {
                    "s3ObjectKey": "uploads/1/a0000000-0000-0000-0000-000000000004.jpg",
                    "takenAt": "2026-01-15T10:00:00Z",
                    "latitude": 91.0,
                    "longitude": 139.745433,
                    "categories": ["風景"]
                }
                """;

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("セキュリティ - 経度が範囲外（181.0）の場合400エラー")
    void testCreatePhoto_LongitudeTooHigh_ReturnsBadRequest() throws Exception {
        String requestJson = """
                {
                    "s3ObjectKey": "uploads/1/a0000000-0000-0000-0000-000000000005.jpg",
                    "takenAt": "2026-01-15T10:00:00Z",
                    "latitude": 35.658581,
                    "longitude": 181.0,
                    "categories": ["風景"]
                }
                """;

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("セキュリティ - 緯度が範囲外（-91.0）の場合400エラー")
    void testCreatePhoto_LatitudeTooLow_ReturnsBadRequest() throws Exception {
        String requestJson = """
                {
                    "s3ObjectKey": "uploads/1/a0000000-0000-0000-0000-000000000006.jpg",
                    "takenAt": "2026-01-15T10:00:00Z",
                    "latitude": -91.0,
                    "longitude": 139.745433,
                    "categories": ["風景"]
                }
                """;

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    // ===== バリデーションエラー: S3オブジェクトキーのパターンチェックテスト =====

    @Test
    @DisplayName("セキュリティ - S3オブジェクトキーがパストラバーサルの場合400エラー")
    void testCreatePhoto_S3KeyPathTraversal_ReturnsBadRequest() throws Exception {
        String requestJson = """
                {
                    "s3ObjectKey": "../../../etc/passwd",
                    "takenAt": "2026-01-15T10:00:00Z",
                    "latitude": 35.658581,
                    "longitude": 139.745433,
                    "categories": ["風景"]
                }
                """;

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("セキュリティ - S3オブジェクトキーが不正なフォルダの場合400エラー")
    void testCreatePhoto_S3KeyInvalidFolder_ReturnsBadRequest() throws Exception {
        String requestJson = """
                {
                    "s3ObjectKey": "malicious/1/photo.jpg",
                    "takenAt": "2026-01-15T10:00:00Z",
                    "latitude": 35.658581,
                    "longitude": 139.745433,
                    "categories": ["風景"]
                }
                """;

        mockMvc.perform(post(ENDPOINT_PHOTOS)
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestJson))
                .andExpect(status().isBadRequest());
    }

    // ============================================================
    // Issue#72: 退会済みユーザーの写真非公開テスト
    // ============================================================

    @Test
    @DisplayName("Issue#72 - 退会済みユーザーの写真詳細は404を返す")
    void testGetPhotoDetail_DeletedUser_Returns404() throws Exception {
        // 退会済みユーザーを作成
        User deletedUser = new User();
        deletedUser.setUsername("deletedphoto");
        deletedUser.setEmail("deletedphoto@example.com");
        deletedUser.setPasswordHash(TEST_PASSWORD_HASH);
        deletedUser.setRole(CodeConstants.ROLE_USER);
        deletedUser.setDeletedAt(LocalDateTime.now().minusDays(1));
        deletedUser = userRepository.save(deletedUser);

        Spot spot = createSpot(new BigDecimal("35.658581"), new BigDecimal("139.745433"));

        Photo photo = new Photo();
        photo.setS3ObjectKey("photos/deleted-user-" + System.nanoTime() + ".jpg");
        photo.setShotAt(LocalDateTime.now());
        photo.setUserId(deletedUser.getId());
        photo.setSpotId(spot.getSpotId());
        photo.setModerationStatus(com.photlas.backend.entity.CodeConstants.MODERATION_STATUS_PUBLISHED);
        photo = photoRepository.save(photo);

        mockMvc.perform(get(ENDPOINT_PHOTOS + "/" + photo.getPhotoId())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + token))
                .andExpect(status().isNotFound());
    }
}
