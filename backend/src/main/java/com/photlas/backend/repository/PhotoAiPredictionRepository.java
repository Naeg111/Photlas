package com.photlas.backend.repository;

import com.photlas.backend.entity.PhotoAiPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Issue#119: AI 画像認識結果のリポジトリ。
 */
@Repository
public interface PhotoAiPredictionRepository extends JpaRepository<PhotoAiPrediction, Long> {

    /**
     * 指定写真・モデルの予測結果を取得する（{@code UNIQUE(photo_id, model_name)} があるため最大1件）。
     *
     * @param photoId   写真 ID
     * @param modelName AI モデル名（例: "rekognition-detect-labels"）
     */
    Optional<PhotoAiPrediction> findByPhotoIdAndModelName(Long photoId, String modelName);
}
