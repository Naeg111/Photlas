package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.PhotoTag;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.PhotoTagRepository;
import com.photlas.backend.repository.TagCategoryRepository;
import com.photlas.backend.repository.TagRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#135 Phase 12: 写真ごとのキーワード取得 API のテスト。
 *
 * <p>{@code GET /api/v1/photos/{id}/tags?lang=xx} で、指定写真に紐づく
 * is_active=TRUE のキーワードを言語別表示名つきで返す。</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class PhotoTagsControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private TagRepository tagRepository;
    @Autowired private TagCategoryRepository tagCategoryRepository;
    @Autowired private PhotoTagRepository photoTagRepository;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private UserRepository userRepository;

    private Photo photo;
    private Tag tagCherry;
    private Tag tagInactive;

    @BeforeEach
    void setUp() {
        photoTagRepository.deleteAll();
        tagCategoryRepository.deleteAll();
        tagRepository.deleteAll();

        User user = new User();
        user.setUsername("phototagsapi");
        user.setEmail("phototagsapi@example.com");
        user.setPasswordHash("dummy");
        user.setRole(CodeConstants.ROLE_USER);
        user = userRepository.save(user);

        photo = new Photo();
        photo.setSpotId(1L);
        photo.setUserId(user.getId());
        photo.setS3ObjectKey("test/" + System.nanoTime() + ".jpg");
        photo = photoRepository.save(photo);

        tagCherry = saveTag("Cherry Blossom", "cherry-blossom", "桜", "Cherry Blossom", true);
        tagInactive = saveTag("Hidden", "hidden", "非表示", "Hidden", false);

        PhotoTag pt1 = new PhotoTag(photo.getPhotoId(), tagCherry.getId());
        pt1.setAssignedBy(PhotoTag.ASSIGNED_BY_AI);
        pt1.setAiConfidence(92.5);
        photoTagRepository.saveAndFlush(pt1);

        PhotoTag pt2 = new PhotoTag(photo.getPhotoId(), tagInactive.getId());
        pt2.setAssignedBy(PhotoTag.ASSIGNED_BY_USER);
        photoTagRepository.saveAndFlush(pt2);
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/photos/{id}/tags?lang=ja: アクティブなタグだけを返す")
    void getPhotoTags_returnsActiveTagsOnly() throws Exception {
        mockMvc.perform(get("/api/v1/photos/{id}/tags", photo.getPhotoId()).param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags", hasSize(1)))
                .andExpect(jsonPath("$.tags[0].slug").value("cherry-blossom"))
                .andExpect(jsonPath("$.tags[0].displayName").value("桜"))
                .andExpect(jsonPath("$.tags[*].slug", not(hasItem("hidden"))));
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/photos/{id}/tags?lang=en: 英語表示名を返す")
    void getPhotoTags_returnsEnglishDisplayName() throws Exception {
        mockMvc.perform(get("/api/v1/photos/{id}/tags", photo.getPhotoId()).param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags[0].displayName").value("Cherry Blossom"));
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/photos/{id}/tags: 存在しない photoId でも空配列を返す（404 にはしない）")
    void getPhotoTags_returnsEmptyForNonexistentPhoto() throws Exception {
        mockMvc.perform(get("/api/v1/photos/{id}/tags", 99_999L).param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags", hasSize(0)));
    }

    private Tag saveTag(String label, String slug, String ja, String en, boolean active) {
        Tag t = new Tag();
        t.setRekognitionLabel(label);
        t.setSlug(slug);
        t.setDisplayNameJa(ja);
        t.setDisplayNameEn(en);
        t.setIsActive(active);
        return tagRepository.saveAndFlush(t);
    }
}
