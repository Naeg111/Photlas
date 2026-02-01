package com.photlas.backend.repository;

import com.photlas.backend.entity.Tag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * タグリポジトリ
 * タグの検索・保存を提供します。
 */
@Repository
public interface TagRepository extends JpaRepository<Tag, Long> {

    /**
     * タグ名でタグを検索する
     *
     * @param name タグ名
     * @return タグ（存在しない場合はOptional.empty()）
     */
    Optional<Tag> findByName(String name);
}
