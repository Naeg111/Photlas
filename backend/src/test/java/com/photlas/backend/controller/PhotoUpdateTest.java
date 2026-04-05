package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
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
import java.util.Map;

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Issue#61: 写真メタデータ編集機能のテスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class PhotoUpdateTest {

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

    private static final String ENDPOINT_PHOTOS = "/api/v1/photos";
    private static final String HEADER_AUTHORIZATION = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private User ownerUser;
    private User otherUser;
    private String ownerToken;
    private String otherToken;
    private Spot testSpot;

    @BeforeEach
    void setUp() {
        favoriteRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        categoryRepository.deleteAll();
        userRepository.deleteAll();

        ownerUser = createUser("owner", "owner@example.com");
        otherUser = createUser("other", "other@example.com");
        ownerToken = jwtService.generateToken(ownerUser.getEmail());
        otherToken = jwtService.generateToken(otherUser.getEmail());
        testSpot = createSpot();

        categoryRepository.save(createCategory("風景"));
        categoryRepository.save(createCategory("建築"));
        categoryRepository.save(createCategory("都市・街並み"));

        when(s3Service.generateCdnUrl(anyString()))
                .thenAnswer(inv -> "https://cdn.example.com/" + inv.getArgument(0));
        when(s3Service.generateThumbnailCdnUrl(anyString()))
                .thenAnswer(inv -> "https://cdn.example.com/thumbnails/" + inv.getArgument(0));
    }

    private User createUser(String username, String email) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash("hashedpassword");
        user.setRole(CodeConstants.ROLE_USER);
        return userRepository.save(user);
    }

    private Spot createSpot() {
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(ownerUser.getId());
        return spotRepository.save(spot);
    }

    private Category createCategory(String name) {
        Category category = new Category();
        category.setName(name);
        return category;
    }

    private Photo createPhoto(String s3Key, Integer status) {
        Photo photo = new Photo();
        photo.setS3ObjectKey(s3Key);
        photo.setShotAt(LocalDateTime.now());
        photo.setUserId(ownerUser.getId());
        photo.setSpotId(testSpot.getSpotId());
        photo.setModerationStatus(status);
        photo.setWeather(CodeConstants.WEATHER_SUNNY);
        photo.setPlaceName("東京タワー");
        return photoRepository.save(photo);
    }

    @Test
    @DisplayName("Issue#61 - 天気・場所名を更新すると200が返る")
    void updatePhoto_success_returns200() throws Exception {
        Photo photo = createPhoto("uploads/1/test.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);

        Map<String, Object> request = Map.of(
                "weather", CodeConstants.WEATHER_CLOUDY,
                "placeName", "スカイツリー"
        );

        mockMvc.perform(put(ENDPOINT_PHOTOS + "/" + photo.getPhotoId())
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Issue#61 - 天気のみ変更時はmoderation_statusが変わらない")
    void updatePhoto_weatherChanged_statusUnchanged() throws Exception {
        Photo photo = createPhoto("uploads/1/test3.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);

        Map<String, Object> request = Map.of(
                "weather", CodeConstants.WEATHER_RAIN
        );

        mockMvc.perform(put(ENDPOINT_PHOTOS + "/" + photo.getPhotoId())
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        Photo updated = photoRepository.findById(photo.getPhotoId()).orElseThrow();
        assertEquals(CodeConstants.MODERATION_STATUS_PUBLISHED, updated.getModerationStatus());
    }

    @Test
    @DisplayName("Issue#61 - 非オーナーが編集しようとすると403が返る")
    void updatePhoto_nonOwner_returns403() throws Exception {
        Photo photo = createPhoto("uploads/1/test4.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);

        Map<String, Object> request = Map.of("weather", CodeConstants.WEATHER_RAIN);

        mockMvc.perform(put(ENDPOINT_PHOTOS + "/" + photo.getPhotoId())
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + otherToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Issue#61 - 存在しない写真を編集しようとすると404が返る")
    void updatePhoto_notFound_returns404() throws Exception {
        Map<String, Object> request = Map.of("weather", CodeConstants.WEATHER_SUNNY);

        mockMvc.perform(put(ENDPOINT_PHOTOS + "/99999")
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#61 - REMOVEDの写真を編集しようとすると404が返る")
    void updatePhoto_removed_returns404() throws Exception {
        Photo photo = createPhoto("uploads/1/test5.jpg", CodeConstants.MODERATION_STATUS_REMOVED);

        Map<String, Object> request = Map.of("weather", CodeConstants.WEATHER_SUNNY);

        mockMvc.perform(put(ENDPOINT_PHOTOS + "/" + photo.getPhotoId())
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + ownerToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#61 - 未認証ユーザーが編集しようとすると401が返る")
    void updatePhoto_unauthenticated_returns401() throws Exception {
        Photo photo = createPhoto("uploads/1/test6.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);

        Map<String, Object> request = Map.of("weather", CodeConstants.WEATHER_SUNNY);

        mockMvc.perform(put(ENDPOINT_PHOTOS + "/" + photo.getPhotoId())
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
    }
}
