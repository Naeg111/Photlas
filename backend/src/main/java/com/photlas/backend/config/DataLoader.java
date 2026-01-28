package com.photlas.backend.config;

import com.photlas.backend.entity.Category;
import com.photlas.backend.repository.CategoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * アプリケーション起動時のデータ初期化
 * Issue#9: 写真投稿機能 - カテゴリマスタデータの初期化
 *
 * テスト環境（test profile）では実行されない
 */
@Component
@Profile("!test")
public class DataLoader implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DataLoader.class);

    private final CategoryRepository categoryRepository;

    /**
     * カテゴリ名一覧
     * フロントエンドの PHOTO_CATEGORIES と同期すること
     */
    private static final List<String> CATEGORY_NAMES = List.of(
            "風景",
            "街並み",
            "植物",
            "動物",
            "自動車",
            "バイク",
            "鉄道",
            "飛行機",
            "食べ物",
            "ポートレート",
            "星空",
            "その他"
    );

    public DataLoader(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Override
    public void run(String... args) {
        initializeCategories();
    }

    /**
     * カテゴリを初期化する
     * 既存のカテゴリがない場合のみ追加する
     */
    private void initializeCategories() {
        for (String categoryName : CATEGORY_NAMES) {
            if (categoryRepository.findByName(categoryName).isEmpty()) {
                Category category = new Category();
                category.setName(categoryName);
                categoryRepository.save(category);
                logger.info("カテゴリを追加しました: {}", categoryName);
            }
        }
        logger.info("カテゴリ初期化完了: {} 件", categoryRepository.count());
    }
}
