package com.photlas.backend.service;

import com.photlas.backend.dto.SpotResponse;
import com.photlas.backend.repository.SpotRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SpotService {

    private static final Logger logger = LoggerFactory.getLogger(SpotService.class);

    @Autowired
    private SpotRepository spotRepository;

    @Transactional(readOnly = true)
    public List<SpotResponse> getSpots(BigDecimal north, BigDecimal south, BigDecimal east, BigDecimal west,
                                       List<Integer> categories, List<Integer> months,
                                       List<String> times, List<String> weathers) {
        logger.info("Getting spots within bounds: north={}, south={}, east={}, west={}", north, south, east, west);

        // リポジトリから集計結果を取得
        List<Object[]> results = spotRepository.findSpotsWithFilters(
                north, south, east, west, categories, months, times, weathers
        );

        logger.info("Found {} spots", results.size());

        // SpotResponseに変換
        List<SpotResponse> spotResponses = results.stream()
                .map(this::convertToSpotResponse)
                .collect(Collectors.toList());

        // 最大50件に制限
        if (spotResponses.size() > 50) {
            spotResponses = spotResponses.subList(0, 50);
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
        if (photoCount >= 30) {
            return "Red";
        } else if (photoCount >= 10) {
            return "Orange";
        } else if (photoCount >= 5) {
            return "Yellow";
        } else {
            return "Green";
        }
    }
}
