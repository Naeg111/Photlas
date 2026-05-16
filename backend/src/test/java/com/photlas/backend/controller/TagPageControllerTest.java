package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrlPattern;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#135 Phase 13: {@code GET /tags/{slug}} Thymeleaf ランディングページのテスト。
 *
 * <p>SEO ターゲットの SSR ページ。Thymeleaf テンプレートが正しくレンダリングされ、
 * 404 や言語リダイレクト、hreflang 出力等が要件通りに動くことを検証する。</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TagPageControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private TagRepository tagRepository;

    private Tag cherry;

    @BeforeEach
    void setUp() {
        tagRepository.deleteAll();

        cherry = new Tag();
        cherry.setRekognitionLabel("Cherry Blossom");
        cherry.setSlug("cherry-blossom");
        cherry.setDisplayNameJa("桜");
        cherry.setDisplayNameEn("Cherry Blossom");
        cherry.setDisplayNameZh("樱花");
        cherry.setDisplayNameKo("벚꽃");
        cherry.setDisplayNameEs("Flor de cerezo");
        cherry.setIsActive(true);
        cherry.setSortOrder(10);
        cherry = tagRepository.saveAndFlush(cherry);
    }

    @Test
    @DisplayName("Issue#135 - GET /tags/cherry-blossom?lang=ja: 200 と日本語タイトルを含む HTML")
    void getTagPage_ja_returnsHtmlWithJapaneseTitle() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("桜")));
    }

    @Test
    @DisplayName("Issue#135 - GET /tags/cherry-blossom?lang=en: 英語表示名で返す")
    void getTagPage_en_returnsHtmlWithEnglishTitle() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Cherry Blossom")));
    }

    @Test
    @DisplayName("Issue#135 - GET /tags/{slug}: lang パラメータ未指定なら ?lang=en へ 301 リダイレクト")
    void getTagPage_noLang_redirectsToEnglish() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom"))
                .andExpect(status().isMovedPermanently())
                .andExpect(redirectedUrlPattern("**/tags/cherry-blossom?lang=en"));
    }

    @Test
    @DisplayName("Issue#135 - GET /tags/nonexistent-slug?lang=ja: 404")
    void getTagPage_nonexistentSlug_returns404() throws Exception {
        mockMvc.perform(get("/tags/nonexistent-slug").param("lang", "ja"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#135 - GET /tags/{slug}: is_active=FALSE のキーワードは 404")
    void getTagPage_inactiveTag_returns404() throws Exception {
        cherry.setIsActive(false);
        tagRepository.saveAndFlush(cherry);

        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Issue#135 - GET /tags/{slug}?lang=ja: hreflang メタタグが 5 言語分含まれる")
    void getTagPage_includesHreflangMetaTags() throws Exception {
        mockMvc.perform(get("/tags/cherry-blossom").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("hreflang=\"ja\"")))
                .andExpect(content().string(containsString("hreflang=\"en\"")))
                .andExpect(content().string(containsString("hreflang=\"zh\"")))
                .andExpect(content().string(containsString("hreflang=\"ko\"")))
                .andExpect(content().string(containsString("hreflang=\"es\"")))
                .andExpect(content().string(containsString("hreflang=\"x-default\"")));
    }
}
