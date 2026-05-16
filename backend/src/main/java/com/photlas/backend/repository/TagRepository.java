package com.photlas.backend.repository;

import com.photlas.backend.entity.Tag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Issue#135: キーワードマスタのリポジトリ。
 */
@Repository
public interface TagRepository extends JpaRepository<Tag, Long> {

    /** Rekognition のラベル名（AI マッピングのキー）から検索。is_active を問わない。 */
    Optional<Tag> findByRekognitionLabel(String rekognitionLabel);

    /** slug から検索。is_active を問わない（管理用）。 */
    Optional<Tag> findBySlug(String slug);

    /**
     * slug から検索（is_active=TRUE のみ）。
     * Issue#135 3.6: ランディングページ等の公開経路ではこちらを使う。
     */
    @Query("SELECT t FROM Tag t WHERE t.slug = :slug AND t.isActive = TRUE")
    Optional<Tag> findActiveBySlug(@Param("slug") String slug);

    /** Rekognition ラベル名のリストから一括検索（is_active=TRUE のみ）。AI 付与時に使用。 */
    @Query("SELECT t FROM Tag t WHERE t.rekognitionLabel IN :labels AND t.isActive = TRUE")
    List<Tag> findActiveByRekognitionLabels(@Param("labels") List<String> labels);

    /** ID リストから一括検索（is_active=TRUE のみ）。 */
    @Query("SELECT t FROM Tag t WHERE t.id IN :ids AND t.isActive = TRUE")
    List<Tag> findActiveByIdIn(@Param("ids") List<Long> ids);
}
