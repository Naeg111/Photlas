package com.photlas.backend.controller;

import com.photlas.backend.entity.Category;
import com.photlas.backend.repository.CategoryRepository;
import org.junit.jupiter.api.BeforeEach;
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
 * Issue#16: カテゴリー一覧API - コントローラーテスト
 * TDD Red段階: 実装前のテストケース定義
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class CategoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CategoryRepository categoryRepository;

    @BeforeEach
    public void setUp() {
        categoryRepository.deleteAll();
    }

    @Test
    public void testGetAllCategories_ReturnsEmptyList_WhenNoCategories() throws Exception {
        // 空のデータベースで全カテゴリーを取得
        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    public void testGetAllCategories_ReturnsAllCategories() throws Exception {
        // テストデータ作成
        Category category1 = new Category();
        category1.setName("風景");
        categoryRepository.save(category1);

        Category category2 = new Category();
        category2.setName("街並み");
        categoryRepository.save(category2);

        Category category3 = new Category();
        category3.setName("植物");
        categoryRepository.save(category3);

        // 全カテゴリーを取得
        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].name").value("風景"))
                .andExpect(jsonPath("$[1].name").value("街並み"))
                .andExpect(jsonPath("$[2].name").value("植物"));
    }

    @Test
    public void testGetAllCategories_ReturnsCategoryIdsAndNames() throws Exception {
        // テストデータ作成
        Category category = new Category();
        category.setName("風景");
        Category savedCategory = categoryRepository.save(category);

        // カテゴリーIDと名前が含まれることを確認
        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$[0].categoryId").value(savedCategory.getCategoryId()))
                .andExpect(jsonPath("$[0].name").value("風景"));
    }

    @Test
    public void testGetAllCategories_ReturnsAllStandardCategories() throws Exception {
        // 標準の12カテゴリーを作成
        String[] standardCategories = {
            "風景", "街並み", "植物", "動物", "自動車", "バイク",
            "鉄道", "飛行機", "食べ物", "ポートレート", "星空", "その他"
        };

        for (String categoryName : standardCategories) {
            Category category = new Category();
            category.setName(categoryName);
            categoryRepository.save(category);
        }

        // 全カテゴリーを取得し、12件であることを確認
        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andExpect(jsonPath("$", hasSize(12)));
    }
}
