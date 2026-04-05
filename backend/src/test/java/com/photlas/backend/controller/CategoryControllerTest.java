package com.photlas.backend.controller;

import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.repository.CategoryRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Issue#9: カテゴリAPI テスト
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class CategoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CategoryRepository categoryRepository;

    @Test
    public void testGetAllCategories_ReturnsEmptyListWhenNoCategoriesExist() throws Exception {
        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    public void testGetAllCategories_ReturnsAllCategories() throws Exception {
        Category category1 = new Category();
        category1.setCategoryId(CodeConstants.CATEGORY_NATURE);
        category1.setName("自然風景");
        categoryRepository.save(category1);

        Category category2 = new Category();
        category2.setCategoryId(CodeConstants.CATEGORY_CITYSCAPE);
        category2.setName("街並み");
        categoryRepository.save(category2);

        Category category3 = new Category();
        category3.setCategoryId(CodeConstants.CATEGORY_PLANTS);
        category3.setName("植物");
        categoryRepository.save(category3);

        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$", hasSize(3)));
    }

    @Test
    public void testGetAllCategories_ReturnsCategoryIdsAndNames() throws Exception {
        Category category = new Category();
        category.setCategoryId(CodeConstants.CATEGORY_NATURE);
        category.setName("自然風景");
        categoryRepository.save(category);

        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$[0].categoryId").value(CodeConstants.CATEGORY_NATURE))
                .andExpect(jsonPath("$[0].name").value("自然風景"));
    }

    @Test
    public void testGetAllCategories_ReturnsAllStandardCategories() throws Exception {
        int[][] categories = {
            {CodeConstants.CATEGORY_NATURE, 0}, {CodeConstants.CATEGORY_CITYSCAPE, 0},
            {CodeConstants.CATEGORY_ARCHITECTURE, 0}, {CodeConstants.CATEGORY_NIGHT_VIEW, 0},
            {CodeConstants.CATEGORY_GOURMET, 0}, {CodeConstants.CATEGORY_PLANTS, 0},
            {CodeConstants.CATEGORY_ANIMALS, 0}, {CodeConstants.CATEGORY_WILD_BIRDS, 0},
            {CodeConstants.CATEGORY_CARS, 0}, {CodeConstants.CATEGORY_MOTORCYCLES, 0},
            {CodeConstants.CATEGORY_RAILWAYS, 0}, {CodeConstants.CATEGORY_AIRCRAFT, 0},
            {CodeConstants.CATEGORY_STARRY_SKY, 0}, {CodeConstants.CATEGORY_OTHER, 0}
        };
        String[] names = {
            "自然風景", "街並み", "建造物", "夜景", "グルメ", "植物", "動物",
            "野鳥", "自動車", "バイク", "鉄道", "飛行機", "星空", "その他"
        };

        for (int i = 0; i < categories.length; i++) {
            Category category = new Category();
            category.setCategoryId(categories[i][0]);
            category.setName(names[i]);
            categoryRepository.save(category);
        }

        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$", hasSize(14)));
    }
}
