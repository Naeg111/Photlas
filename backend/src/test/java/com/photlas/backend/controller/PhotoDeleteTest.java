package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.FavoriteRepository;
import com.photlas.backend.repository.PhotoCategoryRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.ReportRepository;
import com.photlas.backend.repository.ModerationDetailRepository;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#57: ユーザーによる写真削除機能のテスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class PhotoDeleteTest {

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
    private FavoriteRepository favoriteRepository;

    @Autowired
    private PhotoCategoryRepository photoCategoryRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private ModerationDetailRepository moderationDetailRepository;

    @Autowired
    private JwtService jwtService;

    @MockBean
    private S3Service s3Service;

    private static final String ENDPOINT_PHOTOS = "/api/v1/photos";
    private static final String HEADER_AUTHORIZATION = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private static final String TEST_EMAIL = "owner@example.com";
    private static final String OTHER_EMAIL = "other@example.com";

    private User ownerUser;
    private User otherUser;
    private String ownerToken;
    private String otherToken;
    private Spot testSpot;

    @BeforeEach
    void setUp() {
        favoriteRepository.deleteAll();
        reportRepository.deleteAll();
        moderationDetailRepository.deleteAll();
        photoCategoryRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();

        ownerUser = createUser("owner", TEST_EMAIL);
        otherUser = createUser("other", OTHER_EMAIL);
        ownerToken = jwtService.generateToken(ownerUser.getEmail());
        otherToken = jwtService.generateToken(otherUser.getEmail());
        testSpot = createSpot();

        when(s3Service.generateCdnUrl(anyString()))
                .thenAnswer(inv -> "https://cdn.example.com/" + inv.getArgument(0));
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

    private Photo createPhoto(String s3Key, Integer status) {
        Photo photo = new Photo();
        photo.setS3ObjectKey(s3Key);
        photo.setShotAt(LocalDateTime.now());
        photo.setUserId(ownerUser.getId());
        photo.setSpotId(testSpot.getSpotId());
        photo.setModerationStatus(status);
        return photoRepository.save(photo);
    }

    @Test
    @DisplayName("Issue#57 - オーナーがPUBLISHED写真を削除すると204が返る")
    void deletePhoto_published_returns204() throws Exception {
        Photo photo = createPhoto("test/photo1.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);

        mockMvc.perform(delete(ENDPOINT_PHOTOS + "/" + photo.getPhotoId())
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + ownerToken))
                .andExpect(status().isNoContent());

        // ソフトデリート確認: ステータスがREMOVEDに変更されていること
        Photo deleted = photoRepository.findById(photo.getPhotoId()).orElseThrow();
        assertEquals(CodeConstants.MODERATION_STATUS_REMOVED, deleted.getModerationStatus());
    }

    @Test
    @DisplayName("Issue#57 - オーナーがPENDING_REVIEW写真を削除すると204が返る")
    void deletePhoto_pendingReview_returns204() throws Exception {
        Photo photo = createPhoto("test/photo2.jpg", CodeConstants.MODERATION_STATUS_PENDING_REVIEW);

        mockMvc.perform(delete(ENDPOINT_PHOTOS + "/" + photo.getPhotoId())
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + ownerToken))
                .andExpect(status().isNoContent());

        Photo deleted = photoRepository.findById(photo.getPhotoId()).orElseThrow();
        assertEquals(CodeConstants.MODERATION_STATUS_REMOVED, deleted.getModerationStatus());
    }

    @Test
    @DisplayName("Issue#57 - オーナーがQUARANTINED写真を削除すると204が返る")
    void deletePhoto_quarantined_returns204() throws Exception {
        Photo photo = createPhoto("test/photo3.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);

        mockMvc.perform(delete(ENDPOINT_PHOTOS + "/" + photo.getPhotoId())
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + ownerToken))
                .andExpect(status().isNoContent());

        Photo deleted = photoRepository.findById(photo.getPhotoId()).orElseThrow();
        assertEquals(CodeConstants.MODERATION_STATUS_REMOVED, deleted.getModerationStatus());
    }

    @Test
    @DisplayName("Issue#57 - 非オーナーが削除しようとすると403が返る")
    void deletePhoto_nonOwner_returns403() throws Exception {
        Photo photo = createPhoto("test/photo4.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);

        mockMvc.perform(delete(ENDPOINT_PHOTOS + "/" + photo.getPhotoId())
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + otherToken))
                .andExpect(status().isForbidden());

        // 写真のステータスが変更されていないこと
        Photo unchanged = photoRepository.findById(photo.getPhotoId()).orElseThrow();
        assertEquals(CodeConstants.MODERATION_STATUS_PUBLISHED, unchanged.getModerationStatus());
    }

    @Test
    @DisplayName("Issue#57 - 存在しない写真を削除しようとすると404が返る")
    void deletePhoto_notFound_returns404() throws Exception {
        mockMvc.perform(delete(ENDPOINT_PHOTOS + "/99999")
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + ownerToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#57 - 既にREMOVEDの写真を削除しようとすると404が返る")
    void deletePhoto_alreadyRemoved_returns404() throws Exception {
        Photo photo = createPhoto("test/photo5.jpg", CodeConstants.MODERATION_STATUS_REMOVED);

        mockMvc.perform(delete(ENDPOINT_PHOTOS + "/" + photo.getPhotoId())
                .with(csrf())
                .header(HEADER_AUTHORIZATION, BEARER_PREFIX + ownerToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#57 - 未認証ユーザーが削除しようとすると401が返る")
    void deletePhoto_unauthenticated_returns401() throws Exception {
        Photo photo = createPhoto("test/photo6.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);

        mockMvc.perform(delete(ENDPOINT_PHOTOS + "/" + photo.getPhotoId())
                .with(csrf()))
                .andExpect(status().isUnauthorized());
    }
}
