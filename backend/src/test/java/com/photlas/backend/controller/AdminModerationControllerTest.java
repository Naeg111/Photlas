package com.photlas.backend.controller;

import com.photlas.backend.entity.*;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.ReportRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Issue#54: 管理者モデレーションコントローラーのテスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AdminModerationControllerTest {

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
    private ReportRepository reportRepository;

    @Autowired
    private JwtService jwtService;

    // テスト用定数 - 管理者ユーザー
    private static final String ADMIN_USERNAME = "adminuser";
    private static final String ADMIN_EMAIL = "admin@example.com";
    private static final String ADMIN_PASSWORD = "AdminPass1";
    private static final String ADMIN_ROLE = "ADMIN";

    // テスト用定数 - 一般ユーザー
    private static final String USER_USERNAME = "normaluser";
    private static final String USER_EMAIL = "user@example.com";
    private static final String USER_PASSWORD = "UserPass1";
    private static final String USER_ROLE = "USER";

    // テスト用定数 - 写真オーナー
    private static final String OWNER_USERNAME = "photoowner";
    private static final String OWNER_EMAIL = "owner@example.com";

    // テスト用定数 - スポット座標
    private static final BigDecimal TEST_LATITUDE = new BigDecimal("35.6895");
    private static final BigDecimal TEST_LONGITUDE = new BigDecimal("139.6917");

    // テスト用定数 - 写真
    private static final String TEST_S3_KEY = "uploads/test-moderation.jpg";
    // エンドポイント定数
    private static final String QUEUE_ENDPOINT = "/api/v1/admin/moderation/queue";
    private static final String APPROVE_ENDPOINT_PREFIX = "/api/v1/admin/moderation/photos/";
    private static final String APPROVE_ENDPOINT_SUFFIX = "/approve";
    private static final String REJECT_ENDPOINT_PREFIX = "/api/v1/admin/moderation/photos/";
    private static final String REJECT_ENDPOINT_SUFFIX = "/reject";

    // ヘッダー定数
    private static final String HEADER_AUTHORIZATION = "Authorization";

    // JSONPath定数
    private static final String JSON_PATH_CONTENT = "$.content";
    private static final String JSON_PATH_TOTAL_ELEMENTS = "$.total_elements";
    private static final String JSON_PATH_TOTAL_PAGES = "$.total_pages";
    private static final String JSON_PATH_MESSAGE = "$.message";

    private User adminUser;
    private User normalUser;
    private User photoOwner;
    private Spot testSpot;
    private String adminToken;
    private String userToken;

    @BeforeEach
    void setUp() {
        reportRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();

        adminUser = createUser(ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_ROLE);
        normalUser = createUser(USER_USERNAME, USER_EMAIL, USER_ROLE);
        photoOwner = createUser(OWNER_USERNAME, OWNER_EMAIL, USER_ROLE);
        testSpot = createSpot(photoOwner.getId());

        adminToken = jwtService.generateTokenWithRole(ADMIN_EMAIL, ADMIN_ROLE);
        userToken = jwtService.generateTokenWithRole(USER_EMAIL, USER_ROLE);
    }

    // ===== GET /api/v1/admin/moderation/queue =====

    @Test
    @DisplayName("Issue#54 - 隔離キュー: 隔離写真がない場合、空のコンテンツが返る")
    void testGetQueue_EmptyQueue_ReturnsEmptyContent() throws Exception {
        mockMvc.perform(get(QUEUE_ENDPOINT)
                .header(HEADER_AUTHORIZATION, getBearerToken(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_CONTENT, hasSize(0)))
                .andExpect(jsonPath(JSON_PATH_TOTAL_ELEMENTS).value(0));
    }

    @Test
    @DisplayName("Issue#54 - 隔離キュー: 隔離写真が正しいJSON構造で返る")
    void testGetQueue_WithQuarantinedPhotos_ReturnsCorrectStructure() throws Exception {
        createPhotoWithStatus(TEST_S3_KEY, ModerationStatus.QUARANTINED);

        mockMvc.perform(get(QUEUE_ENDPOINT)
                .header(HEADER_AUTHORIZATION, getBearerToken(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_CONTENT, hasSize(1)))
                .andExpect(jsonPath("$.content[0].photo_id").isNumber())
                .andExpect(jsonPath("$.content[0].image_url").isString())
                .andExpect(jsonPath("$.content[0].user_id").value(photoOwner.getId()))
                .andExpect(jsonPath("$.content[0].username").value(OWNER_USERNAME))
                .andExpect(jsonPath("$.content[0].created_at").isString());
    }

    @Test
    @DisplayName("Issue#54 - 隔離キュー: ページネーションパラメータが反映される")
    void testGetQueue_WithPagination_RespectsParameters() throws Exception {
        createPhotoWithStatus("uploads/q1.jpg", ModerationStatus.QUARANTINED);
        createPhotoWithStatus("uploads/q2.jpg", ModerationStatus.QUARANTINED);
        createPhotoWithStatus("uploads/q3.jpg", ModerationStatus.QUARANTINED);

        mockMvc.perform(get(QUEUE_ENDPOINT + "?page=0&size=2")
                .header(HEADER_AUTHORIZATION, getBearerToken(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_CONTENT, hasSize(2)))
                .andExpect(jsonPath(JSON_PATH_TOTAL_ELEMENTS).value(3))
                .andExpect(jsonPath(JSON_PATH_TOTAL_PAGES).value(2));
    }

    @Test
    @DisplayName("Issue#54 - 隔離キュー: total_elementsとtotal_pagesが返る")
    void testGetQueue_ReturnsTotalElementsAndPages() throws Exception {
        createPhotoWithStatus("uploads/t1.jpg", ModerationStatus.QUARANTINED);

        mockMvc.perform(get(QUEUE_ENDPOINT)
                .header(HEADER_AUTHORIZATION, getBearerToken(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_TOTAL_ELEMENTS).value(1))
                .andExpect(jsonPath(JSON_PATH_TOTAL_PAGES).value(1));
    }

    @Test
    @DisplayName("Issue#54 - 隔離キュー: 認証なしで401が返る")
    void testGetQueue_NoAuth_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(get(QUEUE_ENDPOINT))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Issue#54 - 隔離キュー: USERロールで403が返る")
    void testGetQueue_UserRole_ReturnsForbidden() throws Exception {
        mockMvc.perform(get(QUEUE_ENDPOINT)
                .header(HEADER_AUTHORIZATION, getBearerToken(userToken)))
                .andExpect(status().isForbidden());
    }

    // ===== POST /api/v1/admin/moderation/photos/{id}/approve =====

    @Test
    @DisplayName("Issue#54 - 承認: 隔離写真を承認すると200が返る")
    void testApprovePhoto_QuarantinedPhoto_ReturnsOk() throws Exception {
        Photo photo = createPhotoWithStatus(TEST_S3_KEY, ModerationStatus.QUARANTINED);

        mockMvc.perform(post(getApproveEndpoint(photo.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_MESSAGE).value("写真を承認しました"));
    }

    @Test
    @DisplayName("Issue#54 - 承認: USERロールで403が返る")
    void testApprovePhoto_UserRole_ReturnsForbidden() throws Exception {
        Photo photo = createPhotoWithStatus(TEST_S3_KEY, ModerationStatus.QUARANTINED);

        mockMvc.perform(post(getApproveEndpoint(photo.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(userToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Issue#54 - 承認: 存在しない写真に対して404が返る")
    void testApprovePhoto_NonExistentPhoto_ReturnsNotFound() throws Exception {
        mockMvc.perform(post(getApproveEndpoint(99999L))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(adminToken)))
                .andExpect(status().isNotFound());
    }

    // ===== POST /api/v1/admin/moderation/photos/{id}/reject =====

    @Test
    @DisplayName("Issue#54 - 拒否: 理由付きで写真を拒否すると200が返る")
    void testRejectPhoto_WithReason_ReturnsOk() throws Exception {
        Photo photo = createPhotoWithStatus(TEST_S3_KEY, ModerationStatus.QUARANTINED);

        mockMvc.perform(post(getRejectEndpoint(photo.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"不適切なコンテンツ\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_MESSAGE).value("写真を拒否しました"));
    }

    @Test
    @DisplayName("Issue#54 - 拒否: 理由なしの場合デフォルト理由が使用される")
    void testRejectPhoto_NoReason_UsesDefaultReason() throws Exception {
        Photo photo = createPhotoWithStatus(TEST_S3_KEY, ModerationStatus.QUARANTINED);

        mockMvc.perform(post(getRejectEndpoint(photo.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath(JSON_PATH_MESSAGE).value("写真を拒否しました"));
    }

    @Test
    @DisplayName("Issue#54 - 拒否: USERロールで403が返る")
    void testRejectPhoto_UserRole_ReturnsForbidden() throws Exception {
        Photo photo = createPhotoWithStatus(TEST_S3_KEY, ModerationStatus.QUARANTINED);

        mockMvc.perform(post(getRejectEndpoint(photo.getPhotoId()))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(userToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"不適切なコンテンツ\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Issue#54 - 拒否: 存在しない写真に対して404が返る")
    void testRejectPhoto_NonExistentPhoto_ReturnsNotFound() throws Exception {
        mockMvc.perform(post(getRejectEndpoint(99999L))
                .with(csrf())
                .header(HEADER_AUTHORIZATION, getBearerToken(adminToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"不適切なコンテンツ\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#54 - 拒否: 認証なしで401が返る")
    void testRejectPhoto_NoAuth_ReturnsUnauthorized() throws Exception {
        mockMvc.perform(post(getRejectEndpoint(1L))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"不適切なコンテンツ\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ===== Issue#54: 隔離キューに通報理由が含まれることのテスト =====

    @Test
    @DisplayName("Issue#54 - 隔離キュー: 通報件数と通報理由が含まれる")
    void testGetQueue_IncludesReportCountAndReasons() throws Exception {
        Photo photo = createPhotoWithStatus(TEST_S3_KEY, ModerationStatus.QUARANTINED);

        // 2件の通報を作成（異なるユーザー、異なる理由）
        createReport(normalUser.getId(), ReportTargetType.PHOTO, photo.getPhotoId(),
                ReportReason.ADULT_CONTENT);
        createReport(adminUser.getId(), ReportTargetType.PHOTO, photo.getPhotoId(),
                ReportReason.VIOLENCE);

        mockMvc.perform(get(QUEUE_ENDPOINT)
                .header(HEADER_AUTHORIZATION, getBearerToken(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].report_count").value(2))
                .andExpect(jsonPath("$.content[0].report_reasons", hasSize(2)))
                .andExpect(jsonPath("$.content[0].report_reasons",
                        containsInAnyOrder("ADULT_CONTENT", "VIOLENCE")));
    }

    @Test
    @DisplayName("Issue#54 - 隔離キュー: 通報がない場合は0件で空配列が返る")
    void testGetQueue_NoReports_ReturnsZeroCountAndEmptyReasons() throws Exception {
        createPhotoWithStatus(TEST_S3_KEY, ModerationStatus.QUARANTINED);

        mockMvc.perform(get(QUEUE_ENDPOINT)
                .header(HEADER_AUTHORIZATION, getBearerToken(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].report_count").value(0))
                .andExpect(jsonPath("$.content[0].report_reasons", hasSize(0)));
    }

    // ===== ヘルパーメソッド =====

    private User createUser(String username, String email, String role) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(new BCryptPasswordEncoder().encode(ADMIN_PASSWORD));
        user.setEmailVerified(true);
        user.setRole(role);
        return userRepository.save(user);
    }

    private Spot createSpot(Long createdByUserId) {
        Spot spot = new Spot();
        spot.setLatitude(TEST_LATITUDE);
        spot.setLongitude(TEST_LONGITUDE);
        spot.setCreatedByUserId(createdByUserId);
        return spotRepository.save(spot);
    }

    private Photo createPhotoWithStatus(String s3Key, ModerationStatus status) {
        Photo photo = new Photo();
        photo.setSpotId(testSpot.getSpotId());
        photo.setUserId(photoOwner.getId());
        photo.setS3ObjectKey(s3Key);
        photo.setShotAt(LocalDateTime.of(2026, 3, 1, 12, 0));
        photo.setModerationStatus(status);
        return photoRepository.save(photo);
    }

    private String getBearerToken(String token) {
        return "Bearer " + token;
    }

    private String getApproveEndpoint(Long photoId) {
        return APPROVE_ENDPOINT_PREFIX + photoId + APPROVE_ENDPOINT_SUFFIX;
    }

    private String getRejectEndpoint(Long photoId) {
        return REJECT_ENDPOINT_PREFIX + photoId + REJECT_ENDPOINT_SUFFIX;
    }

    private Report createReport(Long reporterUserId, ReportTargetType targetType,
                                Long targetId, ReportReason reason) {
        Report report = new Report();
        report.setReporterUserId(reporterUserId);
        report.setTargetType(targetType);
        report.setTargetId(targetId);
        report.setReasonCategory(reason);
        return reportRepository.save(report);
    }
}
