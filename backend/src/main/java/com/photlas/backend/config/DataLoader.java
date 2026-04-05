package com.photlas.backend.config;

import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.repository.CategoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * アプリケーション起動時のデータ初期化
 * Issue#9: 写真投稿機能 - カテゴリマスタデータの初期化
 * Issue#87: 桁区切り数値コード対応 - 固定ID（200番台）でカテゴリを初期化
 *
 * テスト環境（test profile）では実行されない
 */
@Component
@Profile("!test")
public class DataLoader implements CommandLineRunner {

    private static final Logger logger = LoggerFactory.getLogger(DataLoader.class);

    private final CategoryRepository categoryRepository;

    /**
     * カテゴリID→カテゴリ名のマッピング
     * Issue#63: 14ジャンル（ポートレート削除、建造物・夜景・野鳥追加、風景→自然風景、食べ物→グルメ）
     * Issue#87: 固定ID（200番台）を使用
     */
    private static final Map<Integer, String> CATEGORY_MAP = new LinkedHashMap<>();
    static {
        CATEGORY_MAP.put(CodeConstants.CATEGORY_NATURE, "自然風景");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_CITYSCAPE, "街並み");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_ARCHITECTURE, "建造物");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_NIGHT_VIEW, "夜景");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_GOURMET, "グルメ");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_PLANTS, "植物");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_ANIMALS, "動物");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_WILD_BIRDS, "野鳥");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_CARS, "自動車");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_MOTORCYCLES, "バイク");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_RAILWAYS, "鉄道");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_AIRCRAFT, "飛行機");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_STARRY_SKY, "星空");
        CATEGORY_MAP.put(CodeConstants.CATEGORY_OTHER, "その他");
    }

    public DataLoader(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Override
    public void run(String... args) {
        initializeCategories();
    }

    /**
     * カテゴリを初期化する
     * 固定IDで存在しない場合のみ追加する
     */
    private void initializeCategories() {
        for (Map.Entry<Integer, String> entry : CATEGORY_MAP.entrySet()) {
            int categoryId = entry.getKey();
            String categoryName = entry.getValue();
            if (categoryRepository.findById(categoryId).isEmpty()) {
                Category category = new Category();
                category.setCategoryId(categoryId);
                category.setName(categoryName);
                categoryRepository.save(category);
                logger.info("カテゴリを追加しました: id={}, name={}", categoryId, categoryName);
            }
        }
        logger.info("カテゴリ初期化完了: {} 件", categoryRepository.count());
    }
}
