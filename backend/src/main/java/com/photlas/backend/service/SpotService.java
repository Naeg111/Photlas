package com.photlas.backend.service;

import com.photlas.backend.dto.SpotResponse;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.exception.SpotNotFoundException;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

/**
 * スポットサービス
 * スポットの検索・取得などのビジネスロジックを提供します。
 */
@Service
public class SpotService {

    private static final Logger logger = LoggerFactory.getLogger(SpotService.class);
    private static final int PHOTO_COUNT_THRESHOLD_RED = 30;
    private static final int PHOTO_COUNT_THRESHOLD_ORANGE = 10;
    private static final int PHOTO_COUNT_THRESHOLD_YELLOW = 5;
    private static final int MAX_SPOTS_LIMIT = 50;

    private final SpotRepository spotRepository;
    private final PhotoRepository photoRepository;

    public SpotService(SpotRepository spotRepository, PhotoRepository photoRepository) {
        this.spotRepository = spotRepository;
        this.photoRepository = photoRepository;
    }

    @Transactional(readOnly = true)
    public List<SpotResponse> getSpots(BigDecimal north, BigDecimal south, BigDecimal east, BigDecimal west,
                                       List<Integer> subjectCategories, List<Integer> months,
                                       List<String> timesOfDay, List<String> weathers) {
        logger.info("Getting spots within bounds: north={}, south={}, east={}, west={}", north, south, east, west);

        // リポジトリから集計結果を取得
        List<Object[]> results = spotRepository.findSpotsWithFilters(
                north, south, east, west, subjectCategories, months, timesOfDay, weathers
        );

        logger.info("Found {} spots", results.size());

        // SpotResponseに変換
        List<SpotResponse> spotResponses = results.stream()
                .map(this::convertToSpotResponse)
                .collect(Collectors.toList());

        // 最大件数に制限
        if (spotResponses.size() > MAX_SPOTS_LIMIT) {
            spotResponses = spotResponses.subList(0, MAX_SPOTS_LIMIT);
        }

        return spotResponses;
    }

    private SpotResponse convertToSpotResponse(Object[] result) {
        Long spotId = ((Number) result[0]).longValue();
        BigDecimal latitude = (BigDecimal) result[1];
        BigDecimal longitude = (BigDecimal) result[2];
        Integer photoCount = ((Number) result[3]).intValue();
        String thumbnailUrl = (String) result[4];

        // ピンの色を決定
        String pinColor = determinePinColor(photoCount);

        // titleは現在nullまたは空文字列（将来的に緯度経度から生成する可能性がある）
        String title = null;

        return new SpotResponse(spotId, latitude, longitude, title, pinColor, thumbnailUrl, photoCount);
    }

    private String determinePinColor(Integer photoCount) {
        if (photoCount >= PHOTO_COUNT_THRESHOLD_RED) {
            return "Red";
        } else if (photoCount >= PHOTO_COUNT_THRESHOLD_ORANGE) {
            return "Orange";
        } else if (photoCount >= PHOTO_COUNT_THRESHOLD_YELLOW) {
            return "Yellow";
        } else {
            return "Green";
        }
    }

    /**
     * Issue#14: スポットの写真ID一覧を取得
     *
     * @param spotId スポットID
     * @return 写真IDのリスト（撮影日時順）
     */
    @Transactional(readOnly = true)
    public List<Long> getSpotPhotoIds(Long spotId) {
        logger.info("Getting photo IDs for spot: spotId={}", spotId);

        // スポットの存在確認
        Spot spot = spotRepository.findById(spotId)
                .orElseThrow(() -> new SpotNotFoundException("Spot not found"));

        List<Photo> photos = photoRepository.findBySpotIdOrderByShotAtAsc(spotId);

        List<Long> photoIds = photos.stream()
                .map(Photo::getPhotoId)
                .collect(Collectors.toList());

        logger.info("Found {} photos for spot {}", photoIds.size(), spotId);

        return photoIds;
    }
}
