package com.photlas.backend.controller;

import com.photlas.backend.dto.CategoryResponse;
import com.photlas.backend.entity.Category;
import com.photlas.backend.repository.CategoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

/**
 * カテゴリー一覧APIを提供するコントローラー
 * Issue#16: カテゴリー一覧API
 * フロントエンドでカテゴリー名からIDへのマッピングを行うために使用
 */
@RestController
@RequestMapping("/api/v1/categories")
public class CategoryController {

    private static final Logger logger = LoggerFactory.getLogger(CategoryController.class);

    private final CategoryRepository categoryRepository;

    public CategoryController(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    /**
     * 全カテゴリーを取得（IDの昇順）
     * @return カテゴリー一覧
     */
    @GetMapping
    public ResponseEntity<List<CategoryResponse>> getAllCategories() {
        logger.info("GET /api/v1/categories");

        List<Category> categories = categoryRepository.findAllByOrderByCategoryIdAsc();

        List<CategoryResponse> response = categories.stream()
                .map(category -> new CategoryResponse(
                        category.getCategoryId(),
                        category.getName()
                ))
                .collect(Collectors.toList());

        logger.info("Returning {} categories", response.size());

        return ResponseEntity.ok(response);
    }
}
