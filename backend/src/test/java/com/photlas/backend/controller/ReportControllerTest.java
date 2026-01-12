package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.ReportRepository;
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

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class ReportControllerTest {

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
    private ReportRepository reportRepository;

    @Autowired
    private JwtService jwtService;

    private User testUser;
    private Photo testPhoto;
    private String token;

    // Test Data Constants - Reporting User
    private static final String TEST_USERNAME = "testuser";
    private static final String TEST_EMAIL = "test@example.com";
    private static final String TEST_PASSWORD_HASH = "hashedpassword";
    private static final String USER_ROLE = "USER";

    // Test Data Constants - Photo Owner
    private static final String PHOTO_OWNER_USERNAME = "photoowner";
    private static final String PHOTO_OWNER_EMAIL = "owner@example.com";
    private static final String PHOTO_OWNER_PASSWORD_HASH = "hashedpassword";
    private static final String PHOTO_OWNER_ROLE = "USER";

    // Test Data Constants - Category
    private static final String TEST_CATEGORY_NAME = "風景";

    // Test Data Constants - Spot Coordinates
    private static final BigDecimal TEST_LATITUDE = new BigDecimal("35.6895");
    private static final BigDecimal TEST_LONGITUDE = new BigDecimal("139.6917");

    // Test Data Constants - Photo
    private static final String TEST_S3_OBJECT_KEY = "uploads/test.jpg";
    private static final String TEST_PHOTO_TITLE = "テスト写真";
    private static final String TEST_TIME_OF_DAY = "朝";
    private static final String TEST_WEATHER = "晴れ";

    // Test Data Constants - Report Reasons
    private static final String REASON_INAPPROPRIATE_CONTENT = "INAPPROPRIATE_CONTENT";
    private static final String REASON_PRIVACY_VIOLATION = "PRIVACY_VIOLATION";
    private static final String REASON_WRONG_LOCATION = "WRONG_LOCATION";
    private static final String REASON_COPYRIGHT_INFRINGEMENT = "COPYRIGHT_INFRINGEMENT";
    private static final String REASON_INVALID = "INVALID_REASON";

    // Test Data Constants - Report Details
    private static final String DETAILS_INAPPROPRIATE_CONTENT = "不適切な内容が含まれています";
    private static final String DETAILS_PRIVACY_VIOLATION = "プライバシーの問題があります";
    private static final String DETAILS_WRONG_LOCATION = "場所が間違っています";
    private static final String DETAILS_GENERIC = "詳細情報";
    private static final String DETAILS_EMPTY = "";

    // Test Data Constants - Error Messages
    private static final String ERROR_MESSAGE_ALREADY_REPORTED = "すでに報告済みです";

    // Test Data Constants - Validation
    private static final int DETAILS_MAX_LENGTH = 300;
    private static final int DETAILS_OVER_LENGTH = 301;
    private static final String LONG_DETAILS = "あ".repeat(DETAILS_OVER_LENGTH);

    // Endpoint Constants
    private static final String REPORT_ENDPOINT_PREFIX = "/api/v1/photos/";
    private static final String REPORT_ENDPOINT_SUFFIX = "/report";

    // JSONPath Constants
    private static final String JSON_PATH_REPORTING_USER_ID = "$.reportingUserId";
    private static final String JSON_PATH_PHOTO_ID = "$.photoId";
    private static final String JSON_PATH_REASON = "$.reason";
    private static final String JSON_PATH_DETAILS = "$.details";
    private static final String JSON_PATH_MESSAGE = "$.message";

    // Header Constants
    private static final String HEADER_AUTHORIZATION = "Authorization";

    @BeforeEach
    void setUp() {
        // クリーンアップ
        reportRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();

        // テストデータを作成
        testUser = createTestUser(TEST_USERNAME, TEST_EMAIL);
        token = jwtService.generateToken(testUser.getEmail());
        Category category = createTestCategory(TEST_CATEGORY_NAME);
        Spot spot = createTestSpot(TEST_LATITUDE, TEST_LONGITUDE);
        User photoOwner = createPhotoOwner();
        testPhoto = createTestPhoto(photoOwner, spot, category);
    }

    // Helper Methods - Test Data Creation
    private User createTestUser(String username, String email) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(TEST_PASSWORD_HASH);
        user.setRole(USER_ROLE);
        return userRepository.save(user);
    }

    private User createPhotoOwner() {
        User user = new User();
        user.setUsername(PHOTO_OWNER_USERNAME);
        user.setEmail(PHOTO_OWNER_EMAIL);
        user.setPasswordHash(PHOTO_OWNER_PASSWORD_HASH);
        user.setRole(PHOTO_OWNER_ROLE);
        return userRepository.save(user);
    }

    private Category createTestCategory(String name) {
        Category category = new Category();
        category.setName(name);
        return categoryRepository.save(category);
    }

    private Spot createTestSpot(BigDecimal latitude, BigDecimal longitude) {
        Spot spot = new Spot();
        spot.setLatitude(latitude);
        spot.setLongitude(longitude);
        spot.setCreatedByUserId(testUser.getId());
        return spotRepository.save(spot);
    }

    private Photo createTestPhoto(User owner, Spot spot, Category category) {
        Photo photo = new Photo();
        photo.setUserId(owner.getId());
        photo.setSpotId(spot.getSpotId());
        photo.setCategories(java.util.List.of(category));
        photo.setS3ObjectKey(TEST_S3_OBJECT_KEY);
        photo.setTitle(TEST_PHOTO_TITLE);
        photo.setTimeOfDay(TEST_TIME_OF_DAY);
        photo.setWeather(TEST_WEATHER);
        photo.setShotAt(LocalDateTime.now());
        return photoRepository.save(photo);
    }

    private com.photlas.backend.dto.ReportRequest createReportRequest(String reason, String details) {
        return new com.photlas.backend.dto.ReportRequest(reason, details);
    }

    // Helper Methods - Endpoint Building
    private String getReportEndpoint(Long photoId) {
        return REPORT_ENDPOINT_PREFIX + photoId + REPORT_ENDPOINT_SUFFIX;
    }

    private String getBearerToken(String token) {
        return "Bearer " + token;
    }

    // Helper Methods - API Operations
    private void performCreateReport(Long photoId, com.photlas.backend.dto.ReportRequest request) throws Exception {
        mockMvc.perform(post(getReportEndpoint(photoId))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("Issue#19 - 正常ケース: レポート作成成功")
    void testCreateReport_ValidRequest_ReturnsCreated() throws Exception {
        com.photlas.backend.dto.ReportRequest request =
            createReportRequest(REASON_INAPPROPRIATE_CONTENT, DETAILS_INAPPROPRIATE_CONTENT);

        mockMvc.perform(post(getReportEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath(JSON_PATH_REPORTING_USER_ID).value(testUser.getId()))
                .andExpect(jsonPath(JSON_PATH_PHOTO_ID).value(testPhoto.getPhotoId()))
                .andExpect(jsonPath(JSON_PATH_REASON).value(REASON_INAPPROPRIATE_CONTENT))
                .andExpect(jsonPath(JSON_PATH_DETAILS).value(DETAILS_INAPPROPRIATE_CONTENT));
    }

    @Test
    @DisplayName("Issue#19 - 重複ケース: 同じユーザーが同じ写真を再度報告")
    void testCreateReport_DuplicateReport_ReturnsConflict() throws Exception {
        com.photlas.backend.dto.ReportRequest request =
            createReportRequest(REASON_PRIVACY_VIOLATION, DETAILS_PRIVACY_VIOLATION);

        // 1回目のレポート作成
        performCreateReport(testPhoto.getPhotoId(), request);

        // 2回目のレポート作成（重複）
        mockMvc.perform(post(getReportEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath(JSON_PATH_MESSAGE).value(containsString(ERROR_MESSAGE_ALREADY_REPORTED)));
    }

    @Test
    @DisplayName("Issue#19 - 未認証ケース: 認証なしでアクセス")
    void testCreateReport_Unauthorized_ReturnsUnauthorized() throws Exception {
        com.photlas.backend.dto.ReportRequest request =
            createReportRequest(REASON_WRONG_LOCATION, DETAILS_WRONG_LOCATION);

        mockMvc.perform(post(getReportEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Issue#19 - バリデーションエラー: reasonが空")
    void testCreateReport_MissingReason_ReturnsBadRequest() throws Exception {
        com.photlas.backend.dto.ReportRequest request =
            createReportRequest(null, DETAILS_GENERIC);

        mockMvc.perform(post(getReportEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#19 - バリデーションエラー: detailsが空")
    void testCreateReport_MissingDetails_ReturnsBadRequest() throws Exception {
        com.photlas.backend.dto.ReportRequest request =
            createReportRequest(REASON_COPYRIGHT_INFRINGEMENT, DETAILS_EMPTY);

        mockMvc.perform(post(getReportEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#19 - バリデーションエラー: detailsが300文字超過")
    void testCreateReport_DetailsTooLong_ReturnsBadRequest() throws Exception {
        com.photlas.backend.dto.ReportRequest request =
            createReportRequest(REASON_INAPPROPRIATE_CONTENT, LONG_DETAILS);

        mockMvc.perform(post(getReportEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#19 - バリデーションエラー: 不正なreason値")
    void testCreateReport_InvalidReason_ReturnsBadRequest() throws Exception {
        // JSON文字列を直接作成して不正なreason値を送信
        String invalidRequest = "{\"reason\":\"" + REASON_INVALID + "\",\"details\":\"" + DETAILS_GENERIC + "\"}";

        mockMvc.perform(post(getReportEndpoint(testPhoto.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(token))
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidRequest))
                .andExpect(status().isBadRequest());
    }
}
