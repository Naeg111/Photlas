package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.filter.RateLimitFilter;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.S3Service;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#125 Cycle1: LQIP コールバック内部 API テスト
 * POST /api/v1/internal/photos/lqip
 *
 * Lambda が生成した LQIP（data URL 形式）をバックエンド DB に書き込むための
 * 内部 API。API キー認証で保護される（既存の moderation API キーを共用）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class LqipCallbackTest {

    private static final String ENDPOINT = "/api/v1/internal/photos/lqip";
    private static final String API_KEY_HEADER = "X-API-Key";
    private static final String VALID_API_KEY = "test-moderation-api-key";
    private static final String INVALID_API_KEY = "invalid-key";

    private static final String FIELD_S3_OBJECT_KEY = "s3_object_key";
    private static final String FIELD_LQIP_DATA_URL = "lqip_data_url";

    private static final String SAMPLE_LQIP_DATA_URL =
            "data:image/webp;base64,UklGRhwAAABXRUJQVlA4TBAAAAAvAAAAAA8B//+v/wAA";

    @MockitoBean
    private S3Service s3Service;

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
    private RateLimitFilter rateLimitFilter;

    private Photo testPhoto;

    @BeforeEach
    void setUp() {
        rateLimitFilter.clearCache();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();

        User user = new User();
        user.setUsername("lqipuser");
        user.setEmail("lqip@example.com");
        user.setPasswordHash("hashedpassword");
        user.setRole(CodeConstants.ROLE_USER);
        user = userRepository.save(user);

        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(user.getId());
        spot = spotRepository.save(spot);

        testPhoto = new Photo();
        testPhoto.setSpotId(spot.getSpotId());
        testPhoto.setUserId(user.getId());
        testPhoto.setS3ObjectKey("uploads/" + user.getId() + "/lqip-test.jpg");
        testPhoto.setShotAt(LocalDateTime.now());
        testPhoto.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        testPhoto = photoRepository.save(testPhoto);
    }

    @Test
    @DisplayName("Issue#125 Cycle1 - 正常な LQIP コールバックは 200 を返す")
    void testCallback_Valid_Returns200() throws Exception {
        Map<String, Object> request = new HashMap<>();
        request.put(FIELD_S3_OBJECT_KEY, testPhoto.getS3ObjectKey());
        request.put(FIELD_LQIP_DATA_URL, SAMPLE_LQIP_DATA_URL);

        mockMvc.perform(post(ENDPOINT)
                .header(API_KEY_HEADER, VALID_API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Issue#125 Cycle1 - 不正な API キーは 401 を返す")
    void testCallback_InvalidApiKey_Returns401() throws Exception {
        Map<String, Object> request = new HashMap<>();
        request.put(FIELD_S3_OBJECT_KEY, testPhoto.getS3ObjectKey());
        request.put(FIELD_LQIP_DATA_URL, SAMPLE_LQIP_DATA_URL);

        mockMvc.perform(post(ENDPOINT)
                .header(API_KEY_HEADER, INVALID_API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Issue#125 Cycle1 - 存在しない s3_object_key は 404 を返す（レース条件用）")
    void testCallback_NonExistentS3Key_Returns404() throws Exception {
        Map<String, Object> request = new HashMap<>();
        request.put(FIELD_S3_OBJECT_KEY, "uploads/999/nonexistent.jpg");
        request.put(FIELD_LQIP_DATA_URL, SAMPLE_LQIP_DATA_URL);

        mockMvc.perform(post(ENDPOINT)
                .header(API_KEY_HEADER, VALID_API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#125 Cycle1 - 10KB を超える lqip_data_url は 400 を返す（防御的措置）")
    void testCallback_OversizedLqip_Returns400() throws Exception {
        // 10KB ちょうど超え（10241 文字）の data URL を生成
        StringBuilder oversized = new StringBuilder("data:image/webp;base64,");
        while (oversized.length() <= 10240) {
            oversized.append("A");
        }

        Map<String, Object> request = new HashMap<>();
        request.put(FIELD_S3_OBJECT_KEY, testPhoto.getS3ObjectKey());
        request.put(FIELD_LQIP_DATA_URL, oversized.toString());

        mockMvc.perform(post(ENDPOINT)
                .header(API_KEY_HEADER, VALID_API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#125 Cycle1 - s3_object_key が必須")
    void testCallback_MissingS3Key_Returns400() throws Exception {
        Map<String, Object> request = new HashMap<>();
        request.put(FIELD_LQIP_DATA_URL, SAMPLE_LQIP_DATA_URL);

        mockMvc.perform(post(ENDPOINT)
                .header(API_KEY_HEADER, VALID_API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#125 Cycle1 - lqip_data_url が必須")
    void testCallback_MissingLqipDataUrl_Returns400() throws Exception {
        Map<String, Object> request = new HashMap<>();
        request.put(FIELD_S3_OBJECT_KEY, testPhoto.getS3ObjectKey());

        mockMvc.perform(post(ENDPOINT)
                .header(API_KEY_HEADER, VALID_API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#125 Cycle1 - API キーヘッダがないと 400 を返す")
    void testCallback_NoApiKeyHeader_Returns400() throws Exception {
        Map<String, Object> request = new HashMap<>();
        request.put(FIELD_S3_OBJECT_KEY, testPhoto.getS3ObjectKey());
        request.put(FIELD_LQIP_DATA_URL, SAMPLE_LQIP_DATA_URL);

        mockMvc.perform(post(ENDPOINT)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
