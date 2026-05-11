package com.photlas.backend.service;

import com.photlas.backend.dto.SpotPhotosResponse;
import com.photlas.backend.dto.SpotResponse;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;

/**
 * スポットサービス
 * スポットの検索・取得などのビジネスロジックを提供します。
 */
@Service
public class SpotService {

    private static final Logger logger = LoggerFactory.getLogger(SpotService.class);
    /**
     * Issue#103: ピン色閾値を全体的に引き上げ、1,000 件以上の Purple を追加。
     * 全ズームレベルでクラスタリングピンを表示するようになり、低ズームで
     * 巨大クラスタが発生するため、色のレンジを広げてバランスを取る。
     */
    private static final int PHOTO_COUNT_THRESHOLD_PURPLE = 1000;
    private static final int PHOTO_COUNT_THRESHOLD_RED = 100;
    private static final int PHOTO_COUNT_THRESHOLD_ORANGE = 50;
    private static final int PHOTO_COUNT_THRESHOLD_YELLOW = 10;
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
                                       List<Integer> timesOfDay, List<Integer> weathers) {
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
                                       List<Integer> timesOfDay, List<Integer> weathers,
                                       Integer minResolution, List<Integer> deviceTypes, Integer maxAgeDays,
                                       List<String> aspectRatios, List<String> focalLengthRanges, Integer maxIso) {
        logger.info("Getting spots within bounds: north={}, south={}, east={}, west={}", north, south, east, west);

        // null/空リストをセンチネル値に変換
        List<Integer> safeSubjectCategories = safeIntList(subjectCategories);
        List<Integer> safeMonths = safeIntList(months);
        List<Integer> safeTimesOfDay = safeIntList(timesOfDay);
        List<Integer> safeWeathers = safeIntList(weathers);
        int safeMinResolution = (minResolution != null) ? minResolution : -1;
        List<Integer> safeDeviceTypes = safeIntList(deviceTypes);
        LocalDateTime safeMaxAgeDate = (maxAgeDays != null)
            ? LocalDateTime.now(ZoneId.of("Asia/Tokyo")).minusDays(maxAgeDays)
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

    /**
     * Issue#103: ピン色を投稿件数に応じて決定する。
     * 1〜9: Green / 10〜49: Yellow / 50〜99: Orange / 100〜999: Red / 1000以上: Purple
     * <p>
     * パッケージプライベート可視性は SpotServiceTest からの単体テストを可能にするため。
     */
    String determinePinColor(Integer photoCount) {
        if (photoCount >= PHOTO_COUNT_THRESHOLD_PURPLE) {
            return "Purple";
        } else if (photoCount >= PHOTO_COUNT_THRESHOLD_RED) {
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
     * Issue#112: 複数スポットを横断した写真ID一覧をページング取得（撮影日時降順）
     *
     * @param spotIds 対象スポットID（1件以上）
     * @param limit 取得件数（1〜100）
     * @param offset 取得開始位置（0以上）
     * @param maxAgeDays 撮影日からの最大日数（任意。null なら制限なし）
     * @return 写真IDのページと総件数
     */
    @Transactional(readOnly = true)
    public SpotPhotosResponse getSpotPhotos(List<Long> spotIds, int limit, int offset, Integer maxAgeDays) {
        return getSpotPhotos(spotIds, limit, offset, maxAgeDays, null);
    }

    /**
     * Issue#127: 認証ユーザー本人の PENDING_REVIEW 投稿も結果に含めるバージョン。
     * viewerUserId が null（未認証）の場合は従来通り PUBLISHED のみを返す。
     */
    @Transactional(readOnly = true)
    public SpotPhotosResponse getSpotPhotos(List<Long> spotIds, int limit, int offset,
                                            Integer maxAgeDays, Long viewerUserId) {
        logger.info("Getting paged photos: spotIds={}, limit={}, offset={}, maxAgeDays={}, viewerUserId={}",
                spotIds, limit, offset, maxAgeDays, viewerUserId);

        LocalDateTime maxAgeCutoff = null;
        if (maxAgeDays != null) {
            maxAgeCutoff = LocalDateTime.now(ZoneId.of("Asia/Tokyo")).minusDays(maxAgeDays);
        }

        List<Long> ids;
        long total;
        if (viewerUserId != null) {
            ids = photoRepository.findPhotoIdsBySpotsPagedWithViewer(
                    spotIds,
                    CodeConstants.MODERATION_STATUS_PUBLISHED,
                    CodeConstants.MODERATION_STATUS_PENDING_REVIEW,
                    viewerUserId,
                    maxAgeCutoff,
                    limit,
                    offset);
            total = photoRepository.countPhotosBySpotsWithViewer(
                    spotIds,
                    CodeConstants.MODERATION_STATUS_PUBLISHED,
                    CodeConstants.MODERATION_STATUS_PENDING_REVIEW,
                    viewerUserId,
                    maxAgeCutoff);
        } else {
            ids = photoRepository.findPhotoIdsBySpotsPaged(
                    spotIds,
                    CodeConstants.MODERATION_STATUS_PUBLISHED,
                    maxAgeCutoff,
                    limit,
                    offset);
            total = photoRepository.countPhotosBySpots(
                    spotIds,
                    CodeConstants.MODERATION_STATUS_PUBLISHED,
                    maxAgeCutoff);
        }

        logger.info("Found {} photo ids out of {} total", ids.size(), total);

        return new SpotPhotosResponse(ids, total);
    }

    /**
     * Issue#127: 認証ユーザー本人の PENDING_REVIEW 投稿だけを集計してスポット一覧で返す。
     * /api/v1/spots とは別の軽量経路。CloudFront キャッシュ対象外。
     */
    @Transactional(readOnly = true)
    public List<SpotResponse> getMinePendingSpots(BigDecimal north, BigDecimal south,
                                                  BigDecimal east, BigDecimal west,
                                                  Long viewerUserId) {
        logger.info("Getting mine-pending spots within bounds for user {}", viewerUserId);

        List<Object[]> results = spotRepository.findMinePendingSpots(
                north, south, east, west, viewerUserId);

        List<SpotResponse> spotResponses = results.stream()
                .map(this::convertToSpotResponse)
                .collect(Collectors.toList());

        if (spotResponses.size() > MAX_SPOTS_LIMIT) {
            spotResponses = spotResponses.subList(0, MAX_SPOTS_LIMIT);
        }

        return spotResponses;
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
