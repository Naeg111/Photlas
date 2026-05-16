package com.photlas.backend.controller;

import com.photlas.backend.entity.Tag;
import com.photlas.backend.repository.TagRepository;
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
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SitemapTagsTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private TagRepository tagRepository;

    @BeforeEach
    void setUp() {
        tagRepository.deleteAll();
        Tag cherry = new Tag();
        cherry.setRekognitionLabel("Cherry Blossom");
        cherry.setSlug("cherry-blossom");
        cherry.setDisplayNameJa("桜");
        cherry.setDisplayNameEn("Cherry Blossom");
        cherry.setIsActive(true);
        tagRepository.saveAndFlush(cherry);

        Tag inactive = new Tag();
        inactive.setRekognitionLabel("Hidden");
        inactive.setSlug("hidden-keyword");
        inactive.setDisplayNameJa("非表示");
        inactive.setDisplayNameEn("Hidden");
        inactive.setIsActive(false);
        tagRepository.saveAndFlush(inactive);
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/sitemap.xml: インデックスに sitemap-tags.xml が含まれる")
    void sitemapIndex_includesTagsSitemap() throws Exception {
        mockMvc.perform(get("/api/v1/sitemap.xml"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/api/v1/sitemap-tags.xml")));
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/sitemap-tags.xml: 200 とアクティブキーワードの 5 言語 URL を含む")
    void sitemapTags_containsAllLanguagesForActiveTags() throws Exception {
        mockMvc.perform(get("/api/v1/sitemap-tags.xml"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("/tags/cherry-blossom?lang=en")))
                .andExpect(content().string(containsString("/tags/cherry-blossom?lang=ja")))
                .andExpect(content().string(containsString("/tags/cherry-blossom?lang=zh")))
                .andExpect(content().string(containsString("/tags/cherry-blossom?lang=ko")))
                .andExpect(content().string(containsString("/tags/cherry-blossom?lang=es")));
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/sitemap-tags.xml: is_active=FALSE のキーワードは含まない")
    void sitemapTags_excludesInactiveTags() throws Exception {
        mockMvc.perform(get("/api/v1/sitemap-tags.xml"))
                .andExpect(status().isOk())
                .andExpect(content().string(not(containsString("hidden-keyword"))));
    }
}
