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

    @BeforeEach
    void setUp() {
        // クリーンアップ
        favoriteRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
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

        // テストスポットを作成
        Spot testSpot = new Spot();
        testSpot.setLatitude(new BigDecimal("35.658581"));
        testSpot.setLongitude(new BigDecimal("139.745433"));
        testSpot.setCreatedByUserId(testUser.getId());
        testSpot = spotRepository.save(testSpot);

        // テスト写真を作成
        testPhoto = new Photo();
        testPhoto.setTitle("Test Photo");
        testPhoto.setS3ObjectKey("test/photo.jpg");
        testPhoto.setShotAt(LocalDateTime.now());
        testPhoto.setUserId(testUser.getId());
        testPhoto.setSpotId(testSpot.getSpotId());
        testPhoto = photoRepository.save(testPhoto);
    }

    @Test
    @DisplayName("正常ケース - お気に入り登録")
    void testAddFavorite_ReturnsNoContent() throws Exception {
        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/favorite")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("冪等性 - 同じ写真を2回お気に入り登録してもエラーにならない")
    void testAddFavorite_Idempotent_ReturnsNoContent() throws Exception {
        // 1回目の登録
        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/favorite")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        // 2回目の登録（冪等性）
        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/favorite")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("認証なし - お気に入り登録が401エラーを返す")
    void testAddFavorite_Unauthorized_Returns401() throws Exception {
        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/favorite"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("正常ケース - お気に入り解除")
    void testRemoveFavorite_ReturnsNoContent() throws Exception {
        // まずお気に入り登録
        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/favorite")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        // お気に入り解除
        mockMvc.perform(delete("/api/v1/photos/" + testPhoto.getPhotoId() + "/favorite")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("冪等性 - 存在しないお気に入りを解除してもエラーにならない")
    void testRemoveFavorite_Idempotent_ReturnsNoContent() throws Exception {
        // お気に入り登録していない状態で解除（冪等性）
        mockMvc.perform(delete("/api/v1/photos/" + testPhoto.getPhotoId() + "/favorite")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("認証なし - お気に入り解除が401エラーを返す")
    void testRemoveFavorite_Unauthorized_Returns401() throws Exception {
        mockMvc.perform(delete("/api/v1/photos/" + testPhoto.getPhotoId() + "/favorite"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("正常ケース - お気に入り一覧取得（空の場合）")
    void testGetFavorites_EmptyList_ReturnsEmptyPage() throws Exception {
        mockMvc.perform(get("/api/v1/users/me/favorites")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.pageable.page_number").value(0))
                .andExpect(jsonPath("$.pageable.page_size").value(20))
                .andExpect(jsonPath("$.total_pages").value(0))
                .andExpect(jsonPath("$.total_elements").value(0))
                .andExpect(jsonPath("$.last").value(true));
    }

    @Test
    @DisplayName("正常ケース - お気に入り一覧取得（1件登録後）")
    void testGetFavorites_WithOneFavorite_ReturnsOnePage() throws Exception {
        // お気に入り登録
        mockMvc.perform(post("/api/v1/photos/" + testPhoto.getPhotoId() + "/favorite")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        // お気に入り一覧取得
        mockMvc.perform(get("/api/v1/users/me/favorites")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].photo.photo_id").value(testPhoto.getPhotoId()))
                .andExpect(jsonPath("$.content[0].photo.title").value("Test Photo"))
                .andExpect(jsonPath("$.pageable.page_number").value(0))
                .andExpect(jsonPath("$.pageable.page_size").value(20))
                .andExpect(jsonPath("$.total_pages").value(1))
                .andExpect(jsonPath("$.total_elements").value(1))
                .andExpect(jsonPath("$.last").value(true));
    }

    @Test
    @DisplayName("正常ケース - お気に入り一覧のページネーション")
    void testGetFavorites_WithPagination_ReturnsCorrectPage() throws Exception {
        mockMvc.perform(get("/api/v1/users/me/favorites")
                .param("page", "0")
                .param("size", "10")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pageable.page_number").value(0))
                .andExpect(jsonPath("$.pageable.page_size").value(10));
    }

    @Test
    @DisplayName("認証なし - お気に入り一覧取得が401エラーを返す")
    void testGetFavorites_Unauthorized_Returns401() throws Exception {
        mockMvc.perform(get("/api/v1/users/me/favorites"))
                .andExpect(status().isUnauthorized());
    }
}
