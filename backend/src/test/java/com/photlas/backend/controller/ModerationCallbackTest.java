package com.photlas.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.filter.RateLimitFilter;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#54: Lambda→バックエンドAPIのモデレーションコールバックテスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class ModerationCallbackTest {

    private static final String API_KEY_HEADER = "X-API-Key";
    private static final String TEST_API_KEY = "test-moderation-api-key";

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
        user.setUsername("testuser");
        user.setEmail("test@example.com");
        user.setPasswordHash("hashedpassword");
        user.setRole("USER");
        user = userRepository.save(user);

        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(user.getId());
        spot = spotRepository.save(spot);

        testPhoto = new Photo();
        testPhoto.setSpotId(spot.getSpotId());
        testPhoto.setUserId(user.getId());
        testPhoto.setS3ObjectKey("uploads/" + user.getId() + "/test.jpg");
        testPhoto.setTitle("テスト写真");
        testPhoto.setShotAt(LocalDateTime.now());
        testPhoto.setModerationStatus(ModerationStatus.PENDING_REVIEW);
        testPhoto = photoRepository.save(testPhoto);
    }

    @Test
    @DisplayName("Issue#54 - スキャン結果: 問題なし → PUBLISHED")
    void testModerationCallback_Safe_PublishesPhoto() throws Exception {
        Map<String, Object> request = Map.of(
                "s3_object_key", testPhoto.getS3ObjectKey(),
                "status", "PUBLISHED",
                "confidence_score", 0.1
        );

        mockMvc.perform(post("/api/v1/internal/moderation/callback")
                .header(API_KEY_HEADER, TEST_API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        Photo updated = photoRepository.findById(testPhoto.getPhotoId()).orElseThrow();
        assertThat(updated.getModerationStatus()).isEqualTo(ModerationStatus.PUBLISHED);
    }

    @Test
    @DisplayName("Issue#54 - スキャン結果: 問題あり → QUARANTINED")
    void testModerationCallback_Unsafe_QuarantinesPhoto() throws Exception {
        Map<String, Object> request = Map.of(
                "s3_object_key", testPhoto.getS3ObjectKey(),
                "status", "QUARANTINED",
                "confidence_score", 0.85
        );

        mockMvc.perform(post("/api/v1/internal/moderation/callback")
                .header(API_KEY_HEADER, TEST_API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        Photo updated = photoRepository.findById(testPhoto.getPhotoId()).orElseThrow();
        assertThat(updated.getModerationStatus()).isEqualTo(ModerationStatus.QUARANTINED);
    }

    @Test
    @DisplayName("Issue#54 - 不正なAPIキーでアクセス拒否")
    void testModerationCallback_InvalidApiKey_Returns401() throws Exception {
        Map<String, Object> request = Map.of(
                "s3_object_key", testPhoto.getS3ObjectKey(),
                "status", "PUBLISHED",
                "confidence_score", 0.1
        );

        mockMvc.perform(post("/api/v1/internal/moderation/callback")
                .header(API_KEY_HEADER, "invalid-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }
}
