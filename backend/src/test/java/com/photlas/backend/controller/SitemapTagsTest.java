package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.PhotoTag;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.PhotoTagRepository;
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

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#135 Phase 14: サイトマップにキーワードランディングページを追加するテスト。
 *
 * <p>Issue#150: 写真 0 件のタグページは「ソフト404 / 薄いコンテンツ」と判定されるため、
 * 公開写真が {@link TagPageController#MIN_INDEXABLE_PHOTO_COUNT} 枚以上あるタグだけを
 * サイトマップへ出力する（0 件タグは除外）。</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SitemapTagsTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private TagRepository tagRepository;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private PhotoTagRepository photoTagRepository;
    @Autowired private UserRepository userRepository;

    private User activeUser;

    @BeforeEach
    void setUp() {
        photoTagRepository.deleteAll();
        tagRepository.deleteAll();

        String shortId = String.valueOf(System.nanoTime()).substring(0, 9);
        activeUser = new User();
        activeUser.setUsername("u" + shortId);
        activeUser.setEmail("u" + shortId + "@example.com");
        activeUser.setPasswordHash("dummy");
        activeUser.setRole(CodeConstants.ROLE_USER);
        activeUser = userRepository.save(activeUser);

        // 写真 1 枚以上を持つアクティブキーワード（= サイトマップに含む）
        Tag cherry = newActiveTag("Cherry Blossom", "cherry-blossom", "桜", "Cherry Blossom");
        cherry = tagRepository.saveAndFlush(cherry);
        link(createPublishedPhoto(), cherry);

        // 写真 0 件のアクティブキーワード（= Issue#150 でサイトマップから除外）
        Tag empty = newActiveTag("Empty Keyword", "empty-keyword", "空", "Empty Keyword");
        tagRepository.saveAndFlush(empty);

        // is_active=FALSE のキーワード（従来どおり除外）
        Tag inactive = newActiveTag("Hidden", "hidden-keyword", "非表示", "Hidden");
        inactive.setIsActive(false);
        tagRepository.saveAndFlush(inactive);
    }

    private Tag newActiveTag(String label, String slug, String ja, String en) {
        Tag tag = new Tag();
        tag.setRekognitionLabel(label);
        tag.setSlug(slug);
        tag.setDisplayNameJa(ja);
        tag.setDisplayNameEn(en);
        tag.setIsActive(true);
        return tag;
    }

    private Photo createPublishedPhoto() {
        Photo photo = new Photo();
        photo.setSpotId(1L);
        photo.setUserId(activeUser.getId());
        photo.setS3ObjectKey("sitemap/" + System.nanoTime() + "-" + Math.random() + ".jpg");
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        return photoRepository.saveAndFlush(photo);
    }

    private void link(Photo p, Tag t) {
        PhotoTag pt = new PhotoTag(p.getPhotoId(), t.getId());
        pt.setAssignedBy(PhotoTag.ASSIGNED_BY_USER);
        photoTagRepository.saveAndFlush(pt);
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/sitemap.xml: インデックスに sitemap-tags.xml が含まれる")
    void sitemapIndex_includesTagsSitemap() throws Exception {
        mockMvc.perform(get("/api/v1/sitemap.xml"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/api/v1/sitemap-tags.xml")));
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/sitemap-tags.xml: 写真ありキーワードの 5 言語 URL を含む")
    void sitemapTags_containsAllLanguagesForTagsWithPhotos() throws Exception {
        mockMvc.perform(get("/api/v1/sitemap-tags.xml"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/tags/cherry-blossom?lang=en")))
                .andExpect(content().string(containsString("/tags/cherry-blossom?lang=ja")))
                .andExpect(content().string(containsString("/tags/cherry-blossom?lang=zh")))
                .andExpect(content().string(containsString("/tags/cherry-blossom?lang=ko")))
                .andExpect(content().string(containsString("/tags/cherry-blossom?lang=es")));
    }

    @Test
    @DisplayName("Issue#150 - GET /api/v1/sitemap-tags.xml: 写真 0 件のキーワードは含まない")
    void sitemapTags_excludesTagsWithoutPhotos() throws Exception {
        mockMvc.perform(get("/api/v1/sitemap-tags.xml"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("empty-keyword"))));
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/sitemap-tags.xml: is_active=FALSE のキーワードは含まない")
    void sitemapTags_excludesInactiveTags() throws Exception {
        mockMvc.perform(get("/api/v1/sitemap-tags.xml"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("hidden-keyword"))));
    }
}
