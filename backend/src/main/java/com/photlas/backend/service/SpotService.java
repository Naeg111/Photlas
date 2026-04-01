package com.photlas.backend.service;

import com.photlas.backend.dto.SpotResponse;
import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.exception.SpotNotFoundException;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
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
    private final S3Service s3Service;

    public SpotService(SpotRepository spotRepository, PhotoRepository photoRepository, S3Service s3Service) {
        this.spotRepository = spotRepository;
        this.photoRepository = photoRepository;
        this.s3Service = s3Service;
    }

    @Transactional(readOnly = true)
    public List<SpotResponse> getSpots(BigDecimal north, BigDecimal south, BigDecimal east, BigDecimal west,
                                       List<Integer> subjectCategories, List<Integer> months,
                                       List<String> timesOfDay, List<String> weathers) {
        return getSpots(north, south, east, west, subjectCategories, months, timesOfDay, weathers,
                null, null, null, null, null, null);
    }

    /**
     * Issue#46: 詳細フィルター対応版
     * 機材種別はphotos.device_typeカラムを直接参照してフィルタリングする
     */
    @Transactional(readOnly = true)
    public List<SpotResponse> getSpots(BigDecimal north, BigDecimal south, BigDecimal east, BigDecimal west,
                                       List<Integer> subjectCategories, List<Integer> months,
                                       List<String> timesOfDay, List<String> weathers,
                                       Integer minResolution, List<String> deviceTypes, Integer maxAgeDays,
                                       List<String> aspectRatios, List<String> focalLengthRanges, Integer maxIso) {
        logger.info("Getting spots within bounds: north={}, south={}, east={}, west={}", north, south, east, west);

        // null/空リストをセンチネル値に変換
        List<Integer> safeSubjectCategories = safeIntList(subjectCategories);
        List<Integer> safeMonths = safeIntList(months);
        List<String> safeTimesOfDay = safeStringList(timesOfDay);
        List<String> safeWeathers = safeStringList(weathers);
        int safeMinResolution = (minResolution != null) ? minResolution : -1;
        List<String> safeDeviceTypes = safeStringList(deviceTypes);
        LocalDateTime safeMaxAgeDate = (maxAgeDays != null)
            ? LocalDateTime.now().minusDays(maxAgeDays)
            : LocalDateTime.of(1900, 1, 1, 0, 0);
        List<String> safeAspectRatios = safeStringList(aspectRatios);
        List<String> safeFocalLengthRanges = safeStringList(focalLengthRanges);
        int safeMaxIso = (maxIso != null) ? maxIso : -1;

        // リポジトリから集計結果を取得
        List<Object[]> results = spotRepository.findSpotsWithAdvancedFilters(
                north, south, east, west, safeSubjectCategories, safeMonths, safeTimesOfDay, safeWeathers,
                safeMinResolution, safeDeviceTypes,
                safeMaxAgeDate, safeAspectRatios, safeFocalLengthRanges, safeMaxIso
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
        Integer recentPhotoCount = ((Number) result[3]).intValue();
        Integer totalPhotoCount = ((Number) result[4]).intValue();
        String s3ObjectKey = (String) result[5];

        // Issue#59: S3キーからサムネイルCDN URLに変換
        String thumbnailUrl = s3Service.generateThumbnailCdnUrl(s3ObjectKey);

        // ピンの色はフィルター条件に合致する写真数で決定
        String pinColor = determinePinColor(recentPhotoCount);

        // titleは現在nullまたは空文字列（将来的に緯度経度から生成する可能性がある）
        String title = null;

        // photoCountには全期間のトータル件数を設定（表示用）
        return new SpotResponse(spotId, latitude, longitude, title, pinColor, thumbnailUrl, totalPhotoCount);
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
        spotRepository.findById(spotId)
                .orElseThrow(() -> new SpotNotFoundException("Spot not found"));

        List<Photo> photos = photoRepository.findBySpotIdAndModerationStatusOrderByShotAtAsc(
                spotId, ModerationStatus.PUBLISHED);

        List<Long> photoIds = photos.stream()
                .map(Photo::getPhotoId)
                .collect(Collectors.toList());

        logger.info("Found {} photos for spot {}", photoIds.size(), spotId);

        return photoIds;
    }

    /** null/空リストをセンチネル値（-1）に変換 */
    private List<Integer> safeIntList(List<Integer> list) {
        return (list == null || list.isEmpty()) ? List.of(-1) : list;
    }

    /** null/空リストをセンチネル値（"__NONE__"）に変換 */
    private List<String> safeStringList(List<String> list) {
        return (list == null || list.isEmpty()) ? List.of("__NONE__") : list;
    }
}
