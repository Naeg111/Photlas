package com.photlas.backend.repository;

import com.photlas.backend.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * カテゴリリポジトリ
 * 被写体カテゴリ情報のデータアクセスを提供します。
 */
@Repository
public interface CategoryRepository extends JpaRepository<Category, Integer> {

    /**
     * カテゴリ名でカテゴリを検索
     *
     * @param name カテゴリ名
     * @return カテゴリ（存在しない場合はOptional.empty()）
     */
    Optional<Category> findByName(String name);

    /**
     * 全カテゴリーをIDの昇順で取得
     *
     * @return カテゴリリスト（ID昇順）
     */
    List<Category> findAllByOrderByCategoryIdAsc();
}
