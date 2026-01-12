package com.photlas.backend.repository;

import com.photlas.backend.entity.Photo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PhotoRepository extends JpaRepository<Photo, Long> {

    /**
     * Issue#14: スポットIDで写真を検索し、撮影日時順で並び替える
     *
     * @param spotId スポットID
     * @return 写真のリスト（撮影日時の新しい順）
     */
    List<Photo> findBySpotIdOrderByShotAtAsc(Long spotId);
}
