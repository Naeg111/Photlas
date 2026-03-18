package com.photlas.backend.controller;

import com.photlas.backend.entity.ModerationStatus;
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

    @BeforeEach
    void setUp() {
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();
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
    @DisplayName("サイトマップ - 写真ページが含まれる")
    void testGetSitemap_ContainsPhotoPages() throws Exception {
        // テストデータ作成
        User user = new User();
        user.setUsername("sitemapuser");
        user.setEmail("sitemap@example.com");
        user.setPasswordHash("hashedpassword");
        user.setRole("USER");
        user = userRepository.save(user);

        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(user.getId());
        spot = spotRepository.save(spot);

        Photo photo = new Photo();
        photo.setTitle("サイトマップテスト写真");
        photo.setS3ObjectKey("photos/sitemap-test.jpg");
        photo.setShotAt(LocalDateTime.now());
        photo.setUserId(user.getId());
        photo.setSpotId(spot.getSpotId());
        photo = photoRepository.save(photo);

        mockMvc.perform(get(ENDPOINT_SITEMAP))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/photo-viewer/" + photo.getPhotoId())));
    }

    @Test
    @DisplayName("Issue#54 - QUARANTINED写真はサイトマップに含まれない")
    void testGetSitemap_ExcludesQuarantinedPhotos() throws Exception {
        // Given: QUARANTINED写真
        User user = new User();
        user.setUsername("sitemapuser2");
        user.setEmail("sitemap2@example.com");
        user.setPasswordHash("hashedpassword");
        user.setRole("USER");
        user = userRepository.save(user);

        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(user.getId());
        spot = spotRepository.save(spot);

        Photo quarantinedPhoto = new Photo();
        quarantinedPhoto.setTitle("隔離写真");
        quarantinedPhoto.setS3ObjectKey("photos/quarantined.jpg");
        quarantinedPhoto.setShotAt(LocalDateTime.now());
        quarantinedPhoto.setUserId(user.getId());
        quarantinedPhoto.setSpotId(spot.getSpotId());
        quarantinedPhoto.setModerationStatus(ModerationStatus.QUARANTINED);
        quarantinedPhoto = photoRepository.save(quarantinedPhoto);

        // When & Then: QUARANTINED写真のURLが含まれない
        mockMvc.perform(get(ENDPOINT_SITEMAP))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        containsString("/photo-viewer/" + quarantinedPhoto.getPhotoId()))));
    }

    @Test
    @DisplayName("Issue#54 - PUBLISHED写真のみがサイトマップに含まれる")
    void testGetSitemap_OnlyPublishedPhotosIncluded() throws Exception {
        // Given: PUBLISHED写真1枚、REMOVED写真1枚
        User user = new User();
        user.setUsername("sitemapuser3");
        user.setEmail("sitemap3@example.com");
        user.setPasswordHash("hashedpassword");
        user.setRole("USER");
        user = userRepository.save(user);

        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(user.getId());
        spot = spotRepository.save(spot);

        Photo publishedPhoto = new Photo();
        publishedPhoto.setTitle("公開写真");
        publishedPhoto.setS3ObjectKey("photos/published.jpg");
        publishedPhoto.setShotAt(LocalDateTime.now());
        publishedPhoto.setUserId(user.getId());
        publishedPhoto.setSpotId(spot.getSpotId());
        publishedPhoto.setModerationStatus(ModerationStatus.PUBLISHED);
        publishedPhoto = photoRepository.save(publishedPhoto);

        Photo removedPhoto = new Photo();
        removedPhoto.setTitle("削除写真");
        removedPhoto.setS3ObjectKey("photos/removed.jpg");
        removedPhoto.setShotAt(LocalDateTime.now());
        removedPhoto.setUserId(user.getId());
        removedPhoto.setSpotId(spot.getSpotId());
        removedPhoto.setModerationStatus(ModerationStatus.REMOVED);
        removedPhoto = photoRepository.save(removedPhoto);

        // When & Then: PUBLISHEDのみ含まれる
        mockMvc.perform(get(ENDPOINT_SITEMAP))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/photo-viewer/" + publishedPhoto.getPhotoId())))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        containsString("/photo-viewer/" + removedPhoto.getPhotoId()))));
    }
}
