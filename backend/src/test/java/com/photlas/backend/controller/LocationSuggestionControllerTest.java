package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.photlas.backend.dto.LocationSuggestionRequest;
import com.photlas.backend.entity.*;
import com.photlas.backend.exception.ErrorCodes;
import com.photlas.backend.repository.*;
import com.photlas.backend.service.JwtService;
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

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Issue#65: LocationSuggestionController の統合テスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class LocationSuggestionControllerTest {

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
    private LocationSuggestionRepository locationSuggestionRepository;

    @Autowired
    private JwtService jwtService;

    private static final String HEADER_AUTHORIZATION = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final BigDecimal ORIGINAL_LAT = new BigDecimal("35.658581");
    private static final BigDecimal ORIGINAL_LNG = new BigDecimal("139.745433");
    private static final BigDecimal SUGGESTED_LAT = new BigDecimal("35.681236");
    private static final BigDecimal SUGGESTED_LNG = new BigDecimal("139.767125");

    private User owner;
    private User suggester;
    private Photo photo;
    private Spot spot;
    private String ownerToken;
    private String suggesterToken;

    @BeforeEach
    void setUp() {
        locationSuggestionRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();

        owner = createUser("owner@example.com", "投稿者");
        suggester = createUser("suggester@example.com", "指摘ユーザー");

        spot = createSpot(ORIGINAL_LAT, ORIGINAL_LNG, owner.getId());
        photo = createPhoto(spot.getSpotId(), owner.getId());

        ownerToken = jwtService.generateToken(owner.getEmail());
        suggesterToken = jwtService.generateToken(suggester.getEmail());
    }

    // ========================================
    // POST /api/v1/photos/{photoId}/location-suggestions
    // ========================================

    @Test
    @DisplayName("Issue#65 - 指摘作成: 正常に201が返る")
    void testCreateSuggestion_Success_Returns201() throws Exception {
        LocationSuggestionRequest request = new LocationSuggestionRequest();
        request.setLatitude(SUGGESTED_LAT);
        request.setLongitude(SUGGESTED_LNG);

        mockMvc.perform(post("/api/v1/photos/" + photo.getPhotoId() + "/location-suggestions")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + suggesterToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("Issue#65 - 指摘作成: 未認証の場合401が返る")
    void testCreateSuggestion_Unauthorized_Returns401() throws Exception {
        LocationSuggestionRequest request = new LocationSuggestionRequest();
        request.setLatitude(SUGGESTED_LAT);
        request.setLongitude(SUGGESTED_LNG);

        mockMvc.perform(post("/api/v1/photos/" + photo.getPhotoId() + "/location-suggestions")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Issue#65 - 指摘作成: 自分の写真に対する指摘は400が返る")
    void testCreateSuggestion_OwnPhoto_Returns400() throws Exception {
        LocationSuggestionRequest request = new LocationSuggestionRequest();
        request.setLatitude(SUGGESTED_LAT);
        request.setLongitude(SUGGESTED_LNG);

        mockMvc.perform(post("/api/v1/photos/" + photo.getPhotoId() + "/location-suggestions")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.SUGGESTION_OWN_PHOTO));
    }

    @Test
    @DisplayName("Issue#93 - 指摘作成: 写真が無い場合は 404 と PHOTO_NOT_FOUND が返る")
    void testCreateSuggestion_PhotoNotFound_ReturnsCode() throws Exception {
        LocationSuggestionRequest request = new LocationSuggestionRequest();
        request.setLatitude(SUGGESTED_LAT);
        request.setLongitude(SUGGESTED_LNG);

        mockMvc.perform(post("/api/v1/photos/" + (photo.getPhotoId() + 99999) + "/location-suggestions")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + suggesterToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(ErrorCodes.PHOTO_NOT_FOUND));
    }

    @Test
    @DisplayName("Issue#93 - 指摘作成: 同じ写真に 2 回指摘すると 400 と SUGGESTION_ALREADY_SENT が返る")
    void testCreateSuggestion_AlreadySent_ReturnsCode() throws Exception {
        createPendingSuggestion("token-already-sent");

        LocationSuggestionRequest request = new LocationSuggestionRequest();
        request.setLatitude(SUGGESTED_LAT);
        request.setLongitude(SUGGESTED_LNG);

        mockMvc.perform(post("/api/v1/photos/" + photo.getPhotoId() + "/location-suggestions")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + suggesterToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.SUGGESTION_ALREADY_SENT));
    }

    @Test
    @DisplayName("Issue#93 - 指摘作成: 元の場所から 30m 未満なら 400 と SUGGESTION_TOO_CLOSE が返る")
    void testCreateSuggestion_TooClose_ReturnsCode() throws Exception {
        LocationSuggestionRequest request = new LocationSuggestionRequest();
        request.setLatitude(ORIGINAL_LAT);
        request.setLongitude(ORIGINAL_LNG);

        mockMvc.perform(post("/api/v1/photos/" + photo.getPhotoId() + "/location-suggestions")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + suggesterToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.SUGGESTION_TOO_CLOSE));
    }

    @Test
    @DisplayName("Issue#93 - レビュー: 写真の投稿者以外がレビューすると 403 と ACCESS_DENIED が返る")
    void testReview_NotOwner_ReturnsAccessDenied() throws Exception {
        createPendingSuggestion("token-not-owner");

        mockMvc.perform(get("/api/v1/location-suggestions/review")
                .param("token", "token-not-owner")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + suggesterToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(ErrorCodes.ACCESS_DENIED));
    }

    @Test
    @DisplayName("Issue#93 - レビュー: 解決済みの指摘を受け入れると 400 と SUGGESTION_ALREADY_RESOLVED が返る")
    void testAccept_AlreadyResolved_ReturnsCode() throws Exception {
        LocationSuggestion suggestion = createPendingSuggestion("token-resolved");
        suggestion.setStatus(CodeConstants.SUGGESTION_STATUS_REJECTED);
        locationSuggestionRepository.save(suggestion);

        mockMvc.perform(post("/api/v1/location-suggestions/review/accept")
                .param("token", "token-resolved")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + ownerToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.SUGGESTION_ALREADY_RESOLVED));
    }

    @Test
    @DisplayName("Issue#93 - レビュー情報取得: トークンが無効な場合は 400 と INVALID_TOKEN が返る")
    void testGetReview_InvalidToken_ReturnsCode() throws Exception {
        mockMvc.perform(get("/api/v1/location-suggestions/review")
                .param("token", "no-such-token")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + ownerToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(ErrorCodes.INVALID_TOKEN));
    }

    @Test
    @DisplayName("Issue#65 - 指摘作成: 緯度が範囲外（91）の場合400が返る")
    void testCreateSuggestion_LatitudeOutOfRange_Returns400() throws Exception {
        LocationSuggestionRequest request = new LocationSuggestionRequest();
        request.setLatitude(new BigDecimal("91.0"));
        request.setLongitude(SUGGESTED_LNG);

        mockMvc.perform(post("/api/v1/photos/" + photo.getPhotoId() + "/location-suggestions")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + suggesterToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#65 - 指摘作成: 経度が範囲外（-181）の場合400が返る")
    void testCreateSuggestion_LongitudeOutOfRange_Returns400() throws Exception {
        LocationSuggestionRequest request = new LocationSuggestionRequest();
        request.setLatitude(SUGGESTED_LAT);
        request.setLongitude(new BigDecimal("-181.0"));

        mockMvc.perform(post("/api/v1/photos/" + photo.getPhotoId() + "/location-suggestions")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + suggesterToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ========================================
    // GET /api/v1/photos/{photoId}/location-suggestions/status
    // ========================================

    @Test
    @DisplayName("Issue#65 - 指摘済み確認: 未指摘の場合falseが返る")
    void testGetStatus_NotSuggested_ReturnsFalse() throws Exception {
        mockMvc.perform(get("/api/v1/photos/" + photo.getPhotoId() + "/location-suggestions/status")
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + suggesterToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasSuggested").value(false));
    }

    // ========================================
    // ヘルパーメソッド
    // ========================================

    private LocationSuggestion createPendingSuggestion(String reviewToken) {
        LocationSuggestion suggestion = new LocationSuggestion();
        suggestion.setPhotoId(photo.getPhotoId());
        suggestion.setSuggesterId(suggester.getId());
        suggestion.setSuggestedLatitude(SUGGESTED_LAT);
        suggestion.setSuggestedLongitude(SUGGESTED_LNG);
        suggestion.setStatus(CodeConstants.SUGGESTION_STATUS_PENDING);
        suggestion.setReviewToken(reviewToken);
        return locationSuggestionRepository.save(suggestion);
    }

    private User createUser(String email, String username) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setPasswordHash("hashedpassword");
        user.setRole(CodeConstants.ROLE_USER);
        user.setEmailVerified(true);
        return userRepository.save(user);
    }

    private Spot createSpot(BigDecimal lat, BigDecimal lng, Long userId) {
        Spot s = new Spot();
        s.setLatitude(lat);
        s.setLongitude(lng);
        s.setCreatedByUserId(userId);
        return spotRepository.save(s);
    }

    private Photo createPhoto(Long spotId, Long userId) {
        Photo p = new Photo();
        p.setSpotId(spotId);
        p.setUserId(userId);
        p.setS3ObjectKey("uploads/" + userId + "/test.jpg");
        p.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        p.setShotAt(LocalDateTime.now());
        return photoRepository.save(p);
    }
}
