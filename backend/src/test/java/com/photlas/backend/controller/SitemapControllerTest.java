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
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class SitemapControllerTest {

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

    private static final String ENDPOINT_SITEMAP = "/api/v1/sitemap.xml";

    private User testUser;
    private Spot testSpot;

    @BeforeEach
    void setUp() {
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();

        testUser = new User();
        testUser.setUsername("sitemapuser");
        testUser.setEmail("sitemap@example.com");
        testUser.setPasswordHash("hashedpassword");
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser = userRepository.save(testUser);

        testSpot = new Spot();
        testSpot.setLatitude(new BigDecimal("35.658581"));
        testSpot.setLongitude(new BigDecimal("139.745433"));
        testSpot.setCreatedByUserId(testUser.getId());
        testSpot = spotRepository.save(testSpot);
    }

    @Test
    @DisplayName("サイトマップ - 有効なXMLが返る")
    void testGetSitemap_ReturnsValidXml() throws Exception {
        mockMvc.perform(get(ENDPOINT_SITEMAP))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/xml"))
                .andExpect(content().string(containsString("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")))
                .andExpect(content().string(containsString("<urlset")))
                .andExpect(content().string(containsString("</urlset>")));
    }

    @Test
    @DisplayName("サイトマップ - トップページが含まれる")
    void testGetSitemap_ContainsTopPage() throws Exception {
        mockMvc.perform(get(ENDPOINT_SITEMAP))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<priority>1.0</priority>")));
    }

    @Test
    @DisplayName("サイトマップ - PUBLISHED写真ページが含まれる")
    void testGetSitemap_ContainsPhotoPages() throws Exception {
        Photo photo = createPhoto("photos/sitemap-test.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);

        mockMvc.perform(get(ENDPOINT_SITEMAP))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/photo-viewer/" + photo.getPhotoId())));
    }

    @Test
    @DisplayName("Issue#54 - QUARANTINED写真はサイトマップに含まれない")
    void testGetSitemap_ExcludesQuarantinedPhotos() throws Exception {
        Photo quarantinedPhoto = createPhoto("photos/quarantined.jpg", CodeConstants.MODERATION_STATUS_QUARANTINED);

        mockMvc.perform(get(ENDPOINT_SITEMAP))
                .andExpect(status().isOk())
                .andExpect(content().string(not(
                        containsString("/photo-viewer/" + quarantinedPhoto.getPhotoId()))));
    }

    @Test
    @DisplayName("Issue#54 - PUBLISHED写真のみがサイトマップに含まれる")
    void testGetSitemap_OnlyPublishedPhotosIncluded() throws Exception {
        Photo publishedPhoto = createPhoto("photos/published.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);
        Photo removedPhoto = createPhoto("photos/removed.jpg", CodeConstants.MODERATION_STATUS_REMOVED);

        mockMvc.perform(get(ENDPOINT_SITEMAP))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/photo-viewer/" + publishedPhoto.getPhotoId())))
                .andExpect(content().string(not(
                        containsString("/photo-viewer/" + removedPhoto.getPhotoId()))));
    }

    // ===== サイトマップインデックス方式テスト =====

    @Test
    @DisplayName("Issue#54 - サイトマップインデックスが返る（sitemapindex形式）")
    void testGetSitemap_ReturnsSitemapIndex() throws Exception {
        mockMvc.perform(get(ENDPOINT_SITEMAP))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<sitemapindex")))
                .andExpect(content().string(containsString("sitemap-static.xml")));
    }

    @Test
    @DisplayName("Issue#54 - 静的サイトマップにトップページが含まれる")
    void testGetStaticSitemap_ContainsTopPage() throws Exception {
        mockMvc.perform(get("/api/v1/sitemap-static.xml"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<urlset")))
                .andExpect(content().string(containsString("<priority>1.0</priority>")));
    }

    @Test
    @DisplayName("Issue#54 - 写真サイトマップにPUBLISHED写真が含まれる")
    void testGetPhotosSitemap_ContainsPublishedPhotos() throws Exception {
        Photo photo = createPhoto("photos/idx-test.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);

        mockMvc.perform(get("/api/v1/sitemap-photos-0.xml"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/photo-viewer/" + photo.getPhotoId())));
    }

    @Test
    @DisplayName("Issue#54 - 退会済みユーザーの写真はサイトマップに含まれない")
    void testGetPhotosSitemap_ExcludesDeletedUserPhotos() throws Exception {
        Photo photo = createPhoto("photos/deleted-user.jpg", CodeConstants.MODERATION_STATUS_PUBLISHED);
        testUser.setDeletedAt(LocalDateTime.now());
        userRepository.save(testUser);

        mockMvc.perform(get("/api/v1/sitemap-photos-0.xml"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(
                        containsString("/photo-viewer/" + photo.getPhotoId()))));
    }

    @Test
    @DisplayName("Issue#54 - 存在しないページ番号は404を返す")
    void testGetPhotosSitemap_InvalidPage_Returns404() throws Exception {
        mockMvc.perform(get("/api/v1/sitemap-photos-999.xml"))
                .andExpect(status().isNotFound());
    }

    private Photo createPhoto(String s3ObjectKey, Integer status) {
        Photo photo = new Photo();
        photo.setS3ObjectKey(s3ObjectKey);
        photo.setShotAt(LocalDateTime.now());
        photo.setUserId(testUser.getId());
        photo.setSpotId(testSpot.getSpotId());
        photo.setModerationStatus(status);
        return photoRepository.save(photo);
    }
}
