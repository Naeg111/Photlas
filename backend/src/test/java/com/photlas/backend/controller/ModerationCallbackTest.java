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

import jakarta.persistence.EntityManager;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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

    @Autowired
    private EntityManager entityManager;

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

    @Test
    @DisplayName("Issue#54 - PENDING_REVIEW滞留チェック: 滞留なし")
    void testStaleCheck_NoStale_ReturnsZero() throws Exception {
        // testPhotoは直前に作成されたため滞留していない
        mockMvc.perform(get("/api/v1/internal/moderation/stale-check")
                .header(API_KEY_HEADER, TEST_API_KEY)
                .param("threshold_minutes", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stale_count").value(0));
    }

    @Test
    @DisplayName("Issue#54 - PENDING_REVIEW滞留チェック: 滞留あり")
    void testStaleCheck_HasStale_ReturnsCount() throws Exception {
        // created_atをネイティブクエリで10分前に更新（updatable=falseのため）
        entityManager.createNativeQuery(
                "UPDATE photos SET created_at = :createdAt WHERE photo_id = :photoId")
                .setParameter("createdAt", LocalDateTime.now().minusMinutes(10))
                .setParameter("photoId", testPhoto.getPhotoId())
                .executeUpdate();
        entityManager.flush();

        mockMvc.perform(get("/api/v1/internal/moderation/stale-check")
                .header(API_KEY_HEADER, TEST_API_KEY)
                .param("threshold_minutes", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stale_count").value(1));
    }

    @Test
    @DisplayName("Issue#54 - PENDING_REVIEW滞留チェック: 不正なAPIキー")
    void testStaleCheck_InvalidApiKey_Returns401() throws Exception {
        mockMvc.perform(get("/api/v1/internal/moderation/stale-check")
                .header(API_KEY_HEADER, "invalid-key")
                .param("threshold_minutes", "5"))
                .andExpect(status().isUnauthorized());
    }

    // ===== Issue#54: プロフィール画像モデレーションテスト =====

    @Test
    @DisplayName("Issue#54 - プロフィール画像: QUARANTINED → 画像リセット")
    void testModerationCallback_ProfileImage_Quarantined_ResetsImage() throws Exception {
        // Given: プロフィール画像を設定
        User user = userRepository.findByEmail("test@example.com").orElseThrow();
        String profileS3Key = "profile-images/" + user.getId() + "/photo.jpg";
        user.setProfileImageS3Key(profileS3Key);
        userRepository.save(user);

        Map<String, Object> request = Map.of(
                "s3_object_key", profileS3Key,
                "status", "QUARANTINED",
                "confidence_score", 0.9
        );

        // When
        mockMvc.perform(post("/api/v1/internal/moderation/callback")
                .header(API_KEY_HEADER, TEST_API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // Then: プロフィール画像がリセットされる
        User updated = userRepository.findById(user.getId()).orElseThrow();
        assertThat(updated.getProfileImageS3Key()).isNull();
    }

    @Test
    @DisplayName("Issue#54 - プロフィール画像: PUBLISHED → 画像そのまま")
    void testModerationCallback_ProfileImage_Published_KeepsImage() throws Exception {
        // Given: プロフィール画像を設定
        User user = userRepository.findByEmail("test@example.com").orElseThrow();
        String profileS3Key = "profile-images/" + user.getId() + "/safe.jpg";
        user.setProfileImageS3Key(profileS3Key);
        userRepository.save(user);

        Map<String, Object> request = Map.of(
                "s3_object_key", profileS3Key,
                "status", "PUBLISHED",
                "confidence_score", 0.05
        );

        // When
        mockMvc.perform(post("/api/v1/internal/moderation/callback")
                .header(API_KEY_HEADER, TEST_API_KEY)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        // Then: プロフィール画像はそのまま
        User updated = userRepository.findById(user.getId()).orElseThrow();
        assertThat(updated.getProfileImageS3Key()).isEqualTo(profileS3Key);
    }
}
