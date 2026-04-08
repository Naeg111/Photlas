package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
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
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class OgpControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private UserRepository userRepository;

    @MockBean
    private S3Service s3Service;

    private static final String ENDPOINT_OGP_PHOTO = "/api/v1/ogp/photo/";
    private static final String TEST_CDN_URL = "https://cdn.example.com/photos/test.jpg";

    private User testUser;
    private Spot testSpot;
    private Photo testPhoto;

    @BeforeEach
    void setUp() {
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();

        testUser = new User();
        testUser.setUsername("photographer");
        testUser.setEmail("photo@example.com");
        testUser.setPasswordHash("hashedpassword");
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser = userRepository.save(testUser);

        testSpot = new Spot();
        testSpot.setLatitude(new BigDecimal("35.658581"));
        testSpot.setLongitude(new BigDecimal("139.745433"));
        testSpot.setCreatedByUserId(testUser.getId());
        testSpot = spotRepository.save(testSpot);

        testPhoto = new Photo();
        testPhoto.setS3ObjectKey("photos/test.jpg");
        testPhoto.setShotAt(LocalDateTime.of(2025, 8, 15, 18, 30));
        testPhoto.setUserId(testUser.getId());
        testPhoto.setSpotId(testSpot.getSpotId());
        testPhoto.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        testPhoto = photoRepository.save(testPhoto);

        when(s3Service.generateCdnUrl(anyString())).thenReturn(TEST_CDN_URL);
    }

    @Test
    @DisplayName("OGP - 正常ケース: 写真のOGPメタタグ入りHTMLが返る")
    void testGetPhotoOgp_Success() throws Exception {
        mockMvc.perform(get(ENDPOINT_OGP_PHOTO + testPhoto.getPhotoId()))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/html"))
                .andExpect(content().string(containsString("og:title")))
                .andExpect(content().string(containsString(TEST_CDN_URL)))
                .andExpect(content().string(containsString("og:image")))
                .andExpect(content().string(containsString("twitter:card")))
                .andExpect(content().string(containsString("photographerさんが撮影した写真")))
                .andExpect(content().string(containsString("application/ld+json")))
                .andExpect(content().string(containsString("Photograph")));
    }

    @Test
    @DisplayName("OGP - 存在しない写真IDの場合は404が返る")
    void testGetPhotoOgp_NotFound() throws Exception {
        mockMvc.perform(get(ENDPOINT_OGP_PHOTO + "99999"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("OGP - HTMLにリダイレクトmetaタグが含まれる")
    void testGetPhotoOgp_ContainsRedirect() throws Exception {
        mockMvc.perform(get(ENDPOINT_OGP_PHOTO + testPhoto.getPhotoId()))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("http-equiv=\"refresh\"")))
                .andExpect(content().string(containsString("/photo-viewer/" + testPhoto.getPhotoId())));
    }

    @Test
    @DisplayName("Issue#54 - QUARANTINED写真のOGPリクエストは404を返す")
    void testGetPhotoOgp_QuarantinedPhoto_Returns404() throws Exception {
        // Given: QUARANTINED写真
        testPhoto.setModerationStatus(CodeConstants.MODERATION_STATUS_QUARANTINED);
        photoRepository.save(testPhoto);

        // When & Then
        mockMvc.perform(get(ENDPOINT_OGP_PHOTO + testPhoto.getPhotoId()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#74 - OGPタイトルにplace_nameが使用される")
    void testGetPhotoOgp_UsesPlaceName() throws Exception {
        // Given: place_nameが設定された写真
        testPhoto.setPlaceName("渋谷スクランブルスクエア");
        photoRepository.save(testPhoto);

        // When & Then: OGPタイトルにplace_nameが使用される
        mockMvc.perform(get(ENDPOINT_OGP_PHOTO + testPhoto.getPhotoId()))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("渋谷スクランブルスクエア")));
    }

    @Test
    @DisplayName("Issue#74 - place_name未設定時はOGPタイトルに「Photlas」が使用される")
    void testGetPhotoOgp_NoPlaceName_UsesPhotlas() throws Exception {
        // Given: place_nameが未設定の写真
        testPhoto.setPlaceName(null);
        photoRepository.save(testPhoto);

        // When & Then: OGPタイトルに「Photlas」が使用される
        mockMvc.perform(get(ENDPOINT_OGP_PHOTO + testPhoto.getPhotoId()))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("og:title")))
                .andExpect(content().string(containsString("Photlas")));
    }

    @Test
    @DisplayName("Issue#54 - 退会済みユーザーの写真のOGPリクエストは404を返す")
    void testGetPhotoOgp_DeletedUser_Returns404() throws Exception {
        testUser.setDeletedAt(LocalDateTime.now());
        userRepository.save(testUser);

        mockMvc.perform(get(ENDPOINT_OGP_PHOTO + testPhoto.getPhotoId()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#54 - 永久停止ユーザーの写真のOGPリクエストは404を返す")
    void testGetPhotoOgp_SuspendedUser_Returns404() throws Exception {
        testUser.setRole(CodeConstants.ROLE_SUSPENDED);
        userRepository.save(testUser);

        mockMvc.perform(get(ENDPOINT_OGP_PHOTO + testPhoto.getPhotoId()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#54 - REMOVED写真のOGPリクエストは404を返す")
    void testGetPhotoOgp_RemovedPhoto_Returns404() throws Exception {
        // Given: REMOVED写真
        testPhoto.setModerationStatus(CodeConstants.MODERATION_STATUS_REMOVED);
        photoRepository.save(testPhoto);

        // When & Then
        mockMvc.perform(get(ENDPOINT_OGP_PHOTO + testPhoto.getPhotoId()))
                .andExpect(status().isNotFound());
    }
}
