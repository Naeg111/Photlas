package com.photlas.backend.repository;

import com.photlas.backend.entity.LocationSuggestion;
import com.photlas.backend.entity.LocationSuggestionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Issue#65: 位置情報修正の指摘リポジトリ
 */
@Repository
public interface LocationSuggestionRepository extends JpaRepository<LocationSuggestion, Long> {

    Optional<LocationSuggestion> findByPhotoIdAndSuggesterId(Long photoId, Long suggesterId);

    Optional<LocationSuggestion> findByReviewToken(String reviewToken);

    boolean existsByPhotoIdAndSuggesterId(Long photoId, Long suggesterId);

    boolean existsByPhotoIdAndStatusAndEmailSent(Long photoId, LocationSuggestionStatus status, boolean emailSent);

    List<LocationSuggestion> findByPhotoIdAndStatusAndEmailSentOrderByCreatedAtAsc(
            Long photoId, LocationSuggestionStatus status, boolean emailSent);
}
