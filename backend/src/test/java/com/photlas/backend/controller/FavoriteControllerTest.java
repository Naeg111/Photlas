package com.photlas.backend.controller;

import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.FavoriteRepository;
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

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class FavoriteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private FavoriteRepository favoriteRepository;

    @Autowired
    private JwtService jwtService;

    private User testUser;
    private String token;
    private Photo testPhoto;

    // Test Data Constants - User
    private static final String TEST_USERNAME = "testuser";
    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_PASSWORD_HASH = "hashedpassword";
    private static final String USER_ROLE = "USER";

    // Test Data Constants - Photo
    private static final String TEST_PHOTO_TITLE = "Test Photo";
    private static final String TEST_S3_OBJECT_KEY = "test/photo.jpg";

    // Test Data Constants - Coordinates
    private static final BigDecimal TEST_LATITUDE = new BigDecimal("35.658581");
    private static final BigDecimal TEST_LONGITUDE = new BigDecimal("139.745433");

    // Test Data Constants - Page Parameters
    private static final int DEFAULT_PAGE_NUMBER = 0;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int CUSTOM_PAGE_SIZE = 10;

    // Test Data Constants - Page Counts
    private static final int EMPTY_TOTAL_PAGES = 0;
    private static final int EMPTY_TOTAL_ELEMENTS = 0;
    private static final int ONE_TOTAL_PAGES = 1;
    private static final int ONE_TOTAL_ELEMENTS = 1;

    // Endpoint Constants
    private static final String FAVORITE_ENDPOINT_PREFIX = "/api/v1/photos/";
    private static final String FAVORITE_ENDPOINT_SUFFIX = "/favorite";
    private static final String USER_FAVORITES_ENDPOINT = "/api/v1/users/me/favorites";

    // JSONPath Constants
    private static final String JSON_PATH_CONTENT = "$.content";
    private static final String JSON_PATH_CONTENT_SIZE = "$.content";
    private static final String JSON_PATH_PHOTO_ID = "$.content[0].photo.photo_id";
    private static final String JSON_PATH_PHOTO_TITLE = "$.content[0].photo.title";
    private static final String JSON_PATH_PAGE_NUMBER = "$.pageable.page_number";
    private static final String JSON_PATH_PAGE_SIZE = "$.pageable.page_size";
    private static final String JSON_PATH_TOTAL_PAGES = "$.total_pages";
    private static final String JSON_PATH_TOTAL_ELEMENTS = "$.total_elements";
    private static final String JSON_PATH_LAST = "$.last";

    // Parameter Name Constants
    private static final String PARAM_PAGE = "page";
    private static final String PARAM_SIZE = "size";

    // Header Constants
    private static final String HEADER_AUTHORIZATION = "Authorization";

    @BeforeEach
    void setUp() {
        // クリーンアップ
        favoriteRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();

        // テストデータを作成
        testUser = createTestUser();
        token = jwtService.generateToken(testUser.getEmail());
        Spot testSpot = createTestSpot(testUser);
        testPhoto = createTestPhoto(testUser, testSpot);
    }

    // Helper Methods - Test Data Creation
    private User createTestUser() {
        User user = new User();
        user.setUsername(TEST_USERNAME);
        user.setEmail(TEST_EMAIL);
        user.setPasswordHash(TEST_PASSWORD_HASH);
        user.setRole(USER_ROLE);
        return userRepository.save(user);
    }

    private Spot createTestSpot(User user) {
        Spot spot = new Spot();
        spot.setLatitude(TEST_LATITUDE);
        spot.setLongitude(TEST_LONGITUDE);
        spot.setCreatedByUserId(user.getId());
        return spotRepository.save(spot);
    }

    private Photo createTestPhoto(User user, Spot spot) {
        Photo photo = new Photo();
        photo.setTitle(TEST_PHOTO_TITLE);
        photo.setS3ObjectKey(TEST_S3_OBJECT_KEY);
        photo.setShotAt(LocalDateTime.now());
        photo.setUserId(user.getId());
        photo.setSpotId(spot.getSpotId());
        return photoRepository.save(photo);
    }

    // Helper Methods - Endpoint Building
    private String getFavoriteEndpoint(Long photoId) {
        return FAVORITE_ENDPOINT_PREFIX + photoId + FAVORITE_ENDPOINT_SUFFIX;
    }

    private String getBearerToken(String token) {
        return "Bearer " + token;
    }

    // Helper Methods - API Operations
    private void performAddFavorite(Long photoId) throws Exception {
        mockMvc.perform(post(getFavoriteEndpoint(photoId))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isCreated());
    }

    private void performRemoveFavorite(Long photoId) throws Exception {
        mockMvc.perform(delete(getFavoriteEndpoint(photoId))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isNoContent());
    }

    private void performGetFavorites() throws Exception {
        mockMvc.perform(get(USER_FAVORITES_ENDPOINT)
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isOk());
    }

    private void performGetFavoritesWithPagination(int page, int size) throws Exception {
        mockMvc.perform(get(USER_FAVORITES_ENDPOINT)
                .param(PARAM_PAGE, String.valueOf(page))
                .param(PARAM_SIZE, String.valueOf(size))
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isOk());
    }

    // ============================================================
    // Issue#30: お気に入り追加API テスト
    // ============================================================

    @Test
    @DisplayName("Issue#30 - お気に入り登録成功時は201 Createdを返す")
    void testAddFavorite_ReturnsCreated() throws Exception {
        mockMvc.perform(post(getFavoriteEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("Issue#30 - 既にお気に入り済みの場合は409 Conflictを返す")
    void testAddFavorite_AlreadyFavorited_ReturnsConflict() throws Exception {
        // 1回目の登録
        mockMvc.perform(post(getFavoriteEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isCreated());

        // 2回目の登録（重複）
        mockMvc.perform(post(getFavoriteEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("認証なし - お気に入り登録が401エラーを返す")
    void testAddFavorite_Unauthorized_Returns401() throws Exception {
        mockMvc.perform(post(getFavoriteEndpoint(testPhoto.getPhotoId()))
                .with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    // ============================================================
    // Issue#30: お気に入り削除API テスト
    // ============================================================

    @Test
    @DisplayName("Issue#30 - お気に入り解除成功時は204 No Contentを返す")
    void testRemoveFavorite_ReturnsNoContent() throws Exception {
        // まずお気に入り登録
        mockMvc.perform(post(getFavoriteEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isCreated());

        // お気に入り解除
        mockMvc.perform(delete(getFavoriteEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Issue#30 - お気に入り登録していない写真を解除すると404 Not Foundを返す")
    void testRemoveFavorite_NotFavorited_ReturnsNotFound() throws Exception {
        // お気に入り登録していない状態で解除
        mockMvc.perform(delete(getFavoriteEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("認証なし - お気に入り解除が401エラーを返す")
    void testRemoveFavorite_Unauthorized_Returns401() throws Exception {
        mockMvc.perform(delete(getFavoriteEndpoint(testPhoto.getPhotoId()))
                .with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("正常ケース - お気に入り一覧取得（空の場合）")
    void testGetFavorites_EmptyList_ReturnsEmptyPage() throws Exception {
        mockMvc.perform(get(USER_FAVORITES_ENDPOINT)
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_CONTENT).isArray())
                .andExpect(jsonPath(JSON_PATH_CONTENT).isEmpty())
                .andExpect(jsonPath(JSON_PATH_PAGE_NUMBER).value(DEFAULT_PAGE_NUMBER))
                .andExpect(jsonPath(JSON_PATH_PAGE_SIZE).value(DEFAULT_PAGE_SIZE))
                .andExpect(jsonPath(JSON_PATH_TOTAL_PAGES).value(EMPTY_TOTAL_PAGES))
                .andExpect(jsonPath(JSON_PATH_TOTAL_ELEMENTS).value(EMPTY_TOTAL_ELEMENTS))
                .andExpect(jsonPath(JSON_PATH_LAST).value(true));
    }

    @Test
    @DisplayName("正常ケース - お気に入り一覧取得（1件登録後）")
    void testGetFavorites_WithOneFavorite_ReturnsOnePage() throws Exception {
        // お気に入り登録
        performAddFavorite(testPhoto.getPhotoId());

        // お気に入り一覧取得
        mockMvc.perform(get(USER_FAVORITES_ENDPOINT)
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_CONTENT).isArray())
                .andExpect(jsonPath(JSON_PATH_CONTENT_SIZE, hasSize(1)))
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).value(testPhoto.getPhotoId()))
                .andExpect(jsonPath(JSON_PATH_PHOTO_TITLE).value(TEST_PHOTO_TITLE))
                .andExpect(jsonPath(JSON_PATH_PAGE_NUMBER).value(DEFAULT_PAGE_NUMBER))
                .andExpect(jsonPath(JSON_PATH_PAGE_SIZE).value(DEFAULT_PAGE_SIZE))
                .andExpect(jsonPath(JSON_PATH_TOTAL_PAGES).value(ONE_TOTAL_PAGES))
                .andExpect(jsonPath(JSON_PATH_TOTAL_ELEMENTS).value(ONE_TOTAL_ELEMENTS))
                .andExpect(jsonPath(JSON_PATH_LAST).value(true));
    }

    @Test
    @DisplayName("正常ケース - お気に入り一覧のページネーション")
    void testGetFavorites_WithPagination_ReturnsCorrectPage() throws Exception {
        mockMvc.perform(get(USER_FAVORITES_ENDPOINT)
                .param(PARAM_PAGE, String.valueOf(DEFAULT_PAGE_NUMBER))
                .param(PARAM_SIZE, String.valueOf(CUSTOM_PAGE_SIZE))
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_PAGE_NUMBER).value(DEFAULT_PAGE_NUMBER))
                .andExpect(jsonPath(JSON_PATH_PAGE_SIZE).value(CUSTOM_PAGE_SIZE));
    }

    @Test
    @DisplayName("認証なし - お気に入り一覧取得が401エラーを返す")
    void testGetFavorites_Unauthorized_Returns401() throws Exception {
        mockMvc.perform(get(USER_FAVORITES_ENDPOINT))
                .andExpect(status().isUnauthorized());
    }

    // ============================================================
    // Issue#30: 写真詳細API拡張テスト（favoriteCount）
    // ============================================================

    private static final String PHOTO_DETAIL_ENDPOINT = "/api/v1/photos/";
    private static final String JSON_PATH_FAVORITE_COUNT = "$.photo.favorite_count";

    @Test
    @DisplayName("Issue#30 - 写真詳細APIでfavoriteCountが返される（0件の場合）")
    void testPhotoDetail_ReturnsFavoriteCount_Zero() throws Exception {
        mockMvc.perform(get(PHOTO_DETAIL_ENDPOINT + testPhoto.getPhotoId())
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_FAVORITE_COUNT).value(0));
    }

    @Test
    @DisplayName("Issue#30 - 写真詳細APIでfavoriteCountが返される（1件の場合）")
    void testPhotoDetail_ReturnsFavoriteCount_One() throws Exception {
        // お気に入り登録
        performAddFavorite(testPhoto.getPhotoId());

        // 写真詳細取得
        mockMvc.perform(get(PHOTO_DETAIL_ENDPOINT + testPhoto.getPhotoId())
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_FAVORITE_COUNT).value(1));
    }

    @Test
    @DisplayName("Issue#30 - 写真詳細APIでfavoriteCountが複数ユーザーの合計を返す")
    void testPhotoDetail_ReturnsFavoriteCount_Multiple() throws Exception {
        // 1人目のユーザーがお気に入り登録
        performAddFavorite(testPhoto.getPhotoId());

        // 2人目のユーザーを作成してお気に入り登録
        User secondUser = new User();
        secondUser.setUsername("seconduser");
        secondUser.setEmail("second@example.com");
        secondUser.setPasswordHash(TEST_PASSWORD_HASH);
        secondUser.setRole(USER_ROLE);
        userRepository.save(secondUser);

        String secondToken = jwtService.generateToken(secondUser.getEmail());

        mockMvc.perform(post(getFavoriteEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(secondToken)))
                .andExpect(status().isCreated());

        // 写真詳細取得（favoriteCountが2であること）
        mockMvc.perform(get(PHOTO_DETAIL_ENDPOINT + testPhoto.getPhotoId())
                .header(HEADER_AUTHORIZATION, getBearerToken(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_FAVORITE_COUNT).value(2));
    }
}
