package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.PhotoRepository;
// import com.photlas.backend.repository.ReportRepository; // Green段階で有効化
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

    // ReportRepositoryはまだ存在しないため、Green段階で使用
    // @Autowired
    // private ReportRepository reportRepository;

    @Autowired
    private JwtService jwtService;

    private User testUser;
    private Photo testPhoto;
    private String token;

    @BeforeEach
    void setUp() {
        // クリーンアップ
        // reportRepository.deleteAll(); // Green段階で有効化
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

        // カテゴリを作成
        Category category = new Category();
        category.setName("風景");
        category = categoryRepository.save(category);

        // スポットを作成
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.6895"));
        spot.setLongitude(new BigDecimal("139.6917"));
        spot.setCreatedByUserId(testUser.getId());
        spot = spotRepository.save(spot);

        // 別のユーザーが投稿した写真を作成（報告対象）
        User photoOwner = new User();
        photoOwner.setUsername("photoowner");
        photoOwner.setEmail("owner@example.com");
        photoOwner.setPasswordHash("hashedpassword");
        photoOwner.setRole("USER");
        photoOwner = userRepository.save(photoOwner);

        testPhoto = new Photo();
        testPhoto.setUserId(photoOwner.getId());
        testPhoto.setSpotId(spot.getSpotId());
        testPhoto.setCategories(java.util.List.of(category));
        testPhoto.setS3ObjectKey("uploads/test.jpg");
        testPhoto.setTitle("テスト写真");
        testPhoto.setTimeOfDay("朝");
        testPhoto.setWeather("晴れ");
        testPhoto.setShotAt(LocalDateTime.now());
        testPhoto = photoRepository.save(testPhoto);
    }

    @Test
    @DisplayName("Issue#19 - 正常ケース: レポート作成成功")
    void testCreateReport_ValidRequest_ReturnsCreated() throws Exception {
        com.photlas.backend.dto.ReportRequest request =
            new com.photlas.backend.dto.ReportRequest("INAPPROPRIATE_CONTENT", "不適切な内容が含まれています");

        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/report")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reportingUserId").value(testUser.getId()))
                .andExpect(jsonPath("$.photoId").value(testPhoto.getPhotoId()))
                .andExpect(jsonPath("$.reason").value("INAPPROPRIATE_CONTENT"))
                .andExpect(jsonPath("$.details").value("不適切な内容が含まれています"));
    }

    @Test
    @DisplayName("Issue#19 - 重複ケース: 同じユーザーが同じ写真を再度報告")
    void testCreateReport_DuplicateReport_ReturnsConflict() throws Exception {
        // 1回目のレポート作成
        com.photlas.backend.dto.ReportRequest request =
            new com.photlas.backend.dto.ReportRequest("PRIVACY_VIOLATION", "プライバシーの問題があります");

        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/report")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());

        // 2回目のレポート作成（重複）
        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/report")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(containsString("すでに報告済みです")));
    }

    @Test
    @DisplayName("Issue#19 - 未認証ケース: 認証なしでアクセス")
    void testCreateReport_Unauthorized_ReturnsUnauthorized() throws Exception {
        com.photlas.backend.dto.ReportRequest request =
            new com.photlas.backend.dto.ReportRequest("WRONG_LOCATION", "場所が間違っています");

        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/report")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Issue#19 - バリデーションエラー: reasonが空")
    void testCreateReport_MissingReason_ReturnsBadRequest() throws Exception {
        com.photlas.backend.dto.ReportRequest request =
            new com.photlas.backend.dto.ReportRequest(null, "詳細情報");

        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/report")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#19 - バリデーションエラー: detailsが空")
    void testCreateReport_MissingDetails_ReturnsBadRequest() throws Exception {
        com.photlas.backend.dto.ReportRequest request =
            new com.photlas.backend.dto.ReportRequest("COPYRIGHT_INFRINGEMENT", "");

        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/report")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#19 - バリデーションエラー: detailsが300文字超過")
    void testCreateReport_DetailsTooLong_ReturnsBadRequest() throws Exception {
        String longDetails = "あ".repeat(301);
        com.photlas.backend.dto.ReportRequest request =
            new com.photlas.backend.dto.ReportRequest("INAPPROPRIATE_CONTENT", longDetails);

        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/report")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#19 - バリデーションエラー: 不正なreason値")
    void testCreateReport_InvalidReason_ReturnsBadRequest() throws Exception {
        // JSON文字列を直接作成して不正なreason値を送信
        String invalidRequest = "{\"reason\":\"INVALID_REASON\",\"details\":\"詳細情報\"}";

        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/report")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidRequest))
                .andExpect(status().isBadRequest());
    }
}
