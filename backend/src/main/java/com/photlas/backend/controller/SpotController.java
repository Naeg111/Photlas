package com.photlas.backend.controller;

import com.photlas.backend.dto.SpotPhotosRequest;
import com.photlas.backend.dto.SpotPhotosResponse;
import com.photlas.backend.dto.SpotResponse;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.SpotService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

/**
 * スポット関連のエンドポイントを提供するコントローラー
 */
@RestController
@RequestMapping("/api/v1/spots")
public class SpotController {

    private static final Logger logger = LoggerFactory.getLogger(SpotController.class);

    private final SpotService spotService;
    private final UserRepository userRepository;

    public SpotController(SpotService spotService, UserRepository userRepository) {
        this.spotService = spotService;
        this.userRepository = userRepository;
    }

    /**
     * 地図範囲内のスポット一覧を取得する
     *
     * @param north 北緯
     * @param south 南緯
     * @param east 東経
     * @param west 西経
     * @param subjectCategories 被写体カテゴリーフィルター
     * @param months 月フィルター
     * @param timesOfDay 時間帯フィルター
     * @param weathers 天気フィルター
     * @param minResolution 最小解像度（長辺px）
     * @param deviceTypes 機材種別リスト（SLR / MIRRORLESS / COMPACT / SMARTPHONE / FILM / OTHER）
     * @param maxAgeDays 撮影日からの最大年数
     * @param aspectRatios アスペクト比リスト（HORIZONTAL / VERTICAL / SQUARE）
     * @param focalLengthRanges 焦点距離帯リスト（WIDE / STANDARD / TELEPHOTO / SUPER_TELEPHOTO）
     * @param maxIso 最大ISO感度
     * @return スポット一覧
     */
    @GetMapping
    public ResponseEntity<List<SpotResponse>> getSpots(
            @RequestParam BigDecimal north,
            @RequestParam BigDecimal south,
            @RequestParam BigDecimal east,
            @RequestParam BigDecimal west,
            @RequestParam(name = "subject_categories", required = false) List<Integer> subjectCategories,
            @RequestParam(required = false) List<Integer> months,
            @RequestParam(name = "times_of_day", required = false) List<Integer> timesOfDay,
            @RequestParam(required = false) List<Integer> weathers,
            @RequestParam(name = "min_resolution", required = false) Integer minResolution,
            @RequestParam(name = "device_types", required = false) List<Integer> deviceTypes,
            @RequestParam(name = "max_age_days", required = false) Integer maxAgeDays,
            @RequestParam(name = "aspect_ratios", required = false) List<String> aspectRatios,
            @RequestParam(name = "focal_length_ranges", required = false) List<String> focalLengthRanges,
            @RequestParam(name = "max_iso", required = false) Integer maxIso,
            @RequestParam(name = "tag_ids", required = false) List<Long> tagIds) {

        logger.info("GET /api/v1/spots - north={}, south={}, east={}, west={}, subjectCategories={}, months={}, timesOfDay={}, weathers={}, minResolution={}, deviceTypes={}, maxAgeDays={}, aspectRatios={}, focalLengthRanges={}, maxIso={}, tagIds={}",
                north, south, east, west, subjectCategories, months, timesOfDay, weathers, minResolution, deviceTypes, maxAgeDays, aspectRatios, focalLengthRanges, maxIso, tagIds);

        // 範囲パラメータのバリデーション
        if (north == null || south == null || east == null || west == null) {
            logger.warn("Missing required bounds parameters");
            return ResponseEntity.badRequest().build();
        }

        List<SpotResponse> spots = spotService.getSpots(north, south, east, west, subjectCategories, months, timesOfDay, weathers,
                minResolution, deviceTypes, maxAgeDays, aspectRatios, focalLengthRanges, maxIso, tagIds);

        return ResponseEntity.ok(spots);
    }

    /**
     * Issue#127: 認証ユーザー本人の PENDING_REVIEW（審査中）投稿だけをスポット一覧で返す。
     *
     * /api/v1/spots は CloudFront 共有キャッシュで PUBLISHED のみを返すため、
     * 投稿直後の本人がモデレーション完了前に自分の投稿を地図上で確認できない。
     * 本エンドポイントは認証必須・キャッシュ不可で、他人の PENDING は返さない
     * （プライバシー保護）。フロント側で /spots レスポンスとマージして表示する。
     *
     * @param authentication 認証情報（必須。未認証なら Security 層で 401）
     * @return 自分の PENDING 投稿だけを集計したスポット一覧
     */
    @GetMapping("/mine-pending")
    public ResponseEntity<List<SpotResponse>> getMinePendingSpots(
            @RequestParam BigDecimal north,
            @RequestParam BigDecimal south,
            @RequestParam BigDecimal east,
            @RequestParam BigDecimal west,
            Authentication authentication) {

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません"));

        logger.info("GET /api/v1/spots/mine-pending - viewerUserId={}, north={}, south={}, east={}, west={}",
                user.getId(), north, south, east, west);

        List<SpotResponse> spots = spotService.getMinePendingSpots(north, south, east, west, user.getId());
        return ResponseEntity.ok(spots);
    }

    // Issue#112: ページネーションのデフォルト・上限
    private static final int DEFAULT_PHOTO_PAGE_SIZE = 30;
    private static final int DEFAULT_PHOTO_PAGE_OFFSET = 0;

    /**
     * Issue#112: スポット写真ID一覧をページングで取得（複数スポット横断対応）
     *
     * 撮影日時降順（NULLS LAST）でマージしたページを返す。
     * `spotIds` を Body で受け取るため、巨大クラスタの spot_id 配列でも
     * URL クエリ長制限の影響を受けない。
     *
     * @param request リクエスト Body（spotIds 必須、limit/offset/maxAgeDays は任意）
     * @return 写真IDのページと総件数
     */
    @PostMapping("/photos")
    public ResponseEntity<SpotPhotosResponse> getSpotPhotos(
            @Valid @RequestBody SpotPhotosRequest request,
            Authentication authentication) {
        // Issue#127: 認証済みユーザーは自分の PENDING_REVIEW 投稿も結果に含める。
        // 未認証は従来通り PUBLISHED のみ。/spots/photos は permitAll のため authentication は null になり得る。
        Long viewerUserId = null;
        if (authentication != null && authentication.isAuthenticated()
                && !"anonymousUser".equals(authentication.getPrincipal())) {
            String email = authentication.getName();
            viewerUserId = userRepository.findByEmail(email)
                    .map(User::getId)
                    .orElse(null);
        }

        logger.info("POST /api/v1/spots/photos - spotIds={}, limit={}, offset={}, maxAgeDays={}, viewerUserId={}",
                request.getSpotIds(), request.getLimit(), request.getOffset(), request.getMaxAgeDays(), viewerUserId);

        int limit = request.getLimit() != null ? request.getLimit() : DEFAULT_PHOTO_PAGE_SIZE;
        int offset = request.getOffset() != null ? request.getOffset() : DEFAULT_PHOTO_PAGE_OFFSET;

        SpotPhotosResponse response = spotService.getSpotPhotos(
                request.getSpotIds(), limit, offset, request.getMaxAgeDays(), viewerUserId);

        return ResponseEntity.ok(response);
    }
}
