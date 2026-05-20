package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.IndexHtmlProvider;
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

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#58 §6 (B2): {@code GET /photo-viewer/{id}} のテスト。
 *
 * <p>UA 判定なしで全員に index.html を返し、有効な写真には個別 OGP を差し込む。
 * 無効/非公開は汎用 OGP のまま 200 で返す（SPA が「見つかりません」を表示）。
 * {@link IndexHtmlProvider} はモックし、既知の汎用 OGP 入り index.html を返す。</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PhotoViewerControllerTest {

    /** モックの index.html（汎用 OGP 入り。本番 index.html の該当メタを模した最小版）。 */
    private static final String FIXTURE_INDEX_HTML =
            "<!DOCTYPE html><html lang=\"ja\"><head>"
            + "<meta name=\"description\" content=\"generic-desc\" />"
            + "<meta property=\"og:title\" content=\"Photlas\" />"
            + "<meta property=\"og:description\" content=\"generic-desc\" />"
            + "<meta property=\"og:type\" content=\"website\" />"
            + "<meta property=\"og:url\" content=\"https://photlas.jp/\" />"
            + "<meta property=\"og:image\" content=\"https://photlas.jp/og-image.png\" />"
            + "<meta name=\"twitter:card\" content=\"summary\" />"
            + "<meta name=\"twitter:title\" content=\"Photlas\" />"
            + "<meta name=\"twitter:description\" content=\"generic-desc\" />"
            + "<meta name=\"twitter:image\" content=\"https://photlas.jp/og-image.png\" />"
            + "</head><body><div id=\"root\"></div></body></html>";

    @Autowired private MockMvc mockMvc;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private S3Service s3Service;
    @MockBean private IndexHtmlProvider indexHtmlProvider;

    private User owner;

    @BeforeEach
    void setUp() {
        when(indexHtmlProvider.fetch()).thenReturn(FIXTURE_INDEX_HTML);

        String shortId = String.valueOf(System.nanoTime()).substring(0, 9);
        owner = new User();
        owner.setUsername("u" + shortId);
        owner.setEmail("u" + shortId + "@example.com");
        owner.setPasswordHash("dummy");
        owner.setRole(CodeConstants.ROLE_USER);
        owner = userRepository.save(owner);
    }

    private Photo createPublishedPhoto(String placeName) {
        Photo photo = new Photo();
        photo.setSpotId(1L);
        photo.setUserId(owner.getId());
        photo.setS3ObjectKey("pv/" + System.nanoTime() + "-" + Math.random() + ".jpg");
        photo.setPlaceName(placeName);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        return photoRepository.saveAndFlush(photo);
    }

    @Test
    @DisplayName("Issue#58 §6 - 有効写真: index.html に写真個別 OGP が差し込まれる（汎用 Photlas は置換される）")
    void validPhoto_injectsPerPhotoOgp() throws Exception {
        Photo photo = createPublishedPhoto("Tokyo Tower");
        String expectedImage = s3Service.generateThumbnailCdnUrl(photo.getS3ObjectKey());

        mockMvc.perform(get("/photo-viewer/" + photo.getPhotoId()))
                .andExpect(status().isOk())
                // og:title は写真個別に置換
                .andExpect(content().string(containsString(
                        "property=\"og:title\" content=\"Tokyo Tower - Photlas\"")))
                // og:image は当該写真のサムネ
                .andExpect(content().string(containsString(
                        "property=\"og:image\" content=\"" + expectedImage + "\"")))
                // og:url は当該写真の絶対 URL
                .andExpect(content().string(containsString(
                        "property=\"og:url\" content=\"https://photlas.jp/photo-viewer/" + photo.getPhotoId() + "\"")))
                // twitter:image も差し替わる
                .andExpect(content().string(containsString(
                        "name=\"twitter:image\" content=\"" + expectedImage + "\"")))
                // 汎用 og:title（content="Photlas"）は残っていない
                .andExpect(content().string(not(containsString(
                        "property=\"og:title\" content=\"Photlas\""))));
    }

    @Test
    @DisplayName("Issue#58 §6 - 存在しない id: 汎用 OGP のまま 200 で SPA(index.html) を返す")
    void nonexistentPhoto_returnsGenericOgp200() throws Exception {
        mockMvc.perform(get("/photo-viewer/99999999"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString(
                        "property=\"og:title\" content=\"Photlas\"")))
                .andExpect(content().string(containsString("<div id=\"root\">")));
    }

    @Test
    @DisplayName("Issue#58 §6 - 非公開写真: 汎用 OGP のまま 200")
    void nonPublishedPhoto_returnsGenericOgp200() throws Exception {
        Photo photo = createPublishedPhoto("Hidden");
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_QUARANTINED);
        photoRepository.saveAndFlush(photo);

        mockMvc.perform(get("/photo-viewer/" + photo.getPhotoId()))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString(
                        "property=\"og:title\" content=\"Photlas\"")));
    }

    @Test
    @DisplayName("Issue#58 §6 - 非数値 id: 400 にせず 200 で SPA を返す")
    void nonNumericId_returns200() throws Exception {
        mockMvc.perform(get("/photo-viewer/not-a-number"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<div id=\"root\">")));
    }
}
