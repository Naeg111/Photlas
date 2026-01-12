package com.photlas.backend.repository;

import com.photlas.backend.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Integer> {

    Optional<Category> findByName(String name);

    /**
     * 全カテゴリーをIDの昇順で取得
     */
    List<Category> findAllByOrderByCategoryIdAsc();
}
