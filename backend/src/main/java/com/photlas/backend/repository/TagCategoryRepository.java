package com.photlas.backend.repository;

import com.photlas.backend.entity.TagCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Issue#135: キーワード ↔ カテゴリ多対多リポジトリ。
 */
@Repository
public interface TagCategoryRepository extends JpaRepository<TagCategory, TagCategory.TagCategoryId> {

    /** 1 つの tag が紐づく全カテゴリを取得。 */
    List<TagCategory> findByTagId(Long tagId);

    /** 1 つのカテゴリに紐づく全 tag_id を取得（文脈連動表示用）。 */
    List<TagCategory> findByCategoryCode(Integer categoryCode);

    /** 複数 tag_id に対応する関連を一括取得（写真詳細・検索カード等で利用）。 */
    List<TagCategory> findByTagIdIn(List<Long> tagIds);

    /**
     * Issue#136 Phase 8: 複数カテゴリに紐づく全 tag_id を一括取得（関連キーワード抽出用）。
     * 多対多で同じ tag_id が複数回ヒットしうるので、呼び出し側で distinct すること。
     */
    List<TagCategory> findByCategoryCodeIn(List<Integer> categoryCodes);
}
