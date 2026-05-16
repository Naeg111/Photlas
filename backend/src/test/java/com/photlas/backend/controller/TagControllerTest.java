package com.photlas.backend.controller;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.entity.TagCategory;
import com.photlas.backend.repository.PhotoTagRepository;
import com.photlas.backend.repository.TagCategoryRepository;
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

import java.util.List;

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#135 Phase 8: {@code GET /api/v1/tags} のテスト。
 *
 * <p>フロントが KeywordSection（投稿フォーム・検索フィルタ）で利用する
 * キーワード一覧 + カテゴリ紐付け を返す REST エンドポイント。</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TagControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private TagRepository tagRepository;
    @Autowired private TagCategoryRepository tagCategoryRepository;
    @Autowired private PhotoTagRepository photoTagRepository;

    @BeforeEach
    void setUp() {
        photoTagRepository.deleteAll();
        tagCategoryRepository.deleteAll();
        tagRepository.deleteAll();
    }

    private Tag saveTag(String label, String slug, String ja, String en, int sortOrder, boolean active) {
        Tag t = new Tag();
        t.setRekognitionLabel(label);
        t.setSlug(slug);
        t.setDisplayNameJa(ja);
        t.setDisplayNameEn(en);
        t.setSortOrder(sortOrder);
        t.setIsActive(active);
        return tagRepository.saveAndFlush(t);
    }

    private void linkCategory(Long tagId, int code) {
        tagCategoryRepository.saveAndFlush(new TagCategory(tagId, code));
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/tags?lang=ja: 200 と is_active=TRUE のタグ配列を返す")
    void getTags_returnsActiveTagsWithJapaneseDisplayName() throws Exception {
        Tag cherry = saveTag("Cherry Blossom", "cherry-blossom", "桜", "Cherry Blossom", 10, true);
        linkCategory(cherry.getId(), CodeConstants.CATEGORY_PLANTS);

        mockMvc.perform(get("/api/v1/tags").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$.tags[?(@.slug == 'cherry-blossom')].displayName", hasItem("桜")))
                .andExpect(jsonPath("$.tags[?(@.slug == 'cherry-blossom')].categoryCodes[0]",
                        hasItem(CodeConstants.CATEGORY_PLANTS)));
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/tags: lang=en で英語表示名を返す")
    void getTags_supportsEnglishLanguage() throws Exception {
        Tag cherry = saveTag("Cherry Blossom", "cherry-blossom", "桜", "Cherry Blossom", 10, true);
        linkCategory(cherry.getId(), CodeConstants.CATEGORY_PLANTS);

        mockMvc.perform(get("/api/v1/tags").param("lang", "en"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags[?(@.slug == 'cherry-blossom')].displayName",
                        hasItem("Cherry Blossom")));
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/tags: is_active=FALSE のタグは返さない")
    void getTags_excludesInactiveTags() throws Exception {
        Tag inactive = saveTag("Hidden", "hidden", "非表示", "Hidden", 100, false);
        linkCategory(inactive.getId(), CodeConstants.CATEGORY_PLANTS);
        Tag active = saveTag("Visible", "visible", "表示", "Visible", 100, true);
        linkCategory(active.getId(), CodeConstants.CATEGORY_PLANTS);

        mockMvc.perform(get("/api/v1/tags").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags[*].slug", hasItem("visible")))
                .andExpect(jsonPath("$.tags[*].slug", not(hasItem("hidden"))));
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/tags: 1 タグが複数カテゴリに属している場合、categoryCodes に複数含む")
    void getTags_includesAllCategoriesForMultiCategoryTag() throws Exception {
        Tag bird = saveTag("Bird", "bird", "鳥", "Bird", 10, true);
        linkCategory(bird.getId(), CodeConstants.CATEGORY_ANIMALS);
        linkCategory(bird.getId(), CodeConstants.CATEGORY_WILD_BIRDS);

        mockMvc.perform(get("/api/v1/tags").param("lang", "ja"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags[?(@.slug == 'bird')].categoryCodes[*]",
                        hasItem(CodeConstants.CATEGORY_ANIMALS)))
                .andExpect(jsonPath("$.tags[?(@.slug == 'bird')].categoryCodes[*]",
                        hasItem(CodeConstants.CATEGORY_WILD_BIRDS)));
    }

    @Test
    @DisplayName("Issue#135 - GET /api/v1/tags: lang 未指定時のデフォルトは en")
    void getTags_defaultsLangToEnglish() throws Exception {
        Tag t = saveTag("Mountain", "mountain", "山", "Mountain", 10, true);
        linkCategory(t.getId(), CodeConstants.CATEGORY_NATURE);

        mockMvc.perform(get("/api/v1/tags"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tags[?(@.slug == 'mountain')].displayName",
                        hasItem("Mountain")));
    }
}
