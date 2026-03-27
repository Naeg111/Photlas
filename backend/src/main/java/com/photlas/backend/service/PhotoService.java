package com.photlas.backend.service;

import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.dto.UpdatePhotoRequest;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.AccountSanction;
import com.photlas.backend.exception.AccountSuspendedException;
import com.photlas.backend.exception.CategoryNotFoundException;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.exception.SpotNotFoundException;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.AccountSanctionRepository;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.FavoriteRepository;
import com.photlas.backend.repository.ModerationDetailRepository;
import com.photlas.backend.repository.PhotoCategoryRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.ReportRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.entity.ReportTargetType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.photlas.backend.entity.ModerationStatus;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 写真サービス
 * 写真の投稿・取得などのビジネスロジックを提供します。
 */
@Service
public class PhotoService {

    private static final Logger logger = LoggerFactory.getLogger(PhotoService.class);

    private static final String ROLE_SUSPENDED = "SUSPENDED";
    private static final String ERROR_PHOTO_NOT_FOUND = "写真が見つかりません";
    private static final String ERROR_USER_NOT_FOUND = "ユーザーが見つかりません";
    private static final String ERROR_SPOT_NOT_FOUND = "スポットが見つかりません";

    private final PhotoRepository photoRepository;
    private final SpotRepository spotRepository;
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final FavoriteRepository favoriteRepository;
    private final S3Service s3Service;
    private final AccountSanctionRepository accountSanctionRepository;
    private final PhotoCategoryRepository photoCategoryRepository;
    private final ReportRepository reportRepository;
    private final ModerationDetailRepository moderationDetailRepository;

    public PhotoService(
            PhotoRepository photoRepository,
            SpotRepository spotRepository,
            CategoryRepository categoryRepository,
            UserRepository userRepository,
            FavoriteRepository favoriteRepository,
            S3Service s3Service,
            AccountSanctionRepository accountSanctionRepository,
            PhotoCategoryRepository photoCategoryRepository,
            ReportRepository reportRepository,
            ModerationDetailRepository moderationDetailRepository
    ) {
        this.photoRepository = photoRepository;
        this.spotRepository = spotRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.favoriteRepository = favoriteRepository;
        this.s3Service = s3Service;
        this.accountSanctionRepository = accountSanctionRepository;
        this.photoCategoryRepository = photoCategoryRepository;
        this.reportRepository = reportRepository;
        this.moderationDetailRepository = moderationDetailRepository;
    }

    /**
     * 写真を投稿する
     *
     * @param request 写真投稿リクエスト
     * @param email ログイン中ユーザーのメールアドレス
     * @return 作成された写真の詳細情報
     */
    @Transactional
    public PhotoResponse createPhoto(CreatePhotoRequest request, String email) {
        // ユーザー情報を取得
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

        // Issue#54: アカウント停止チェック
        validateAccountNotSuspended(user);

        // 1. スポットの集約と作成
        Spot spot = findOrCreateSpot(request, user);

        // 2. カテゴリの変換（任意項目）
        List<Category> categories = (request.getCategories() != null && !request.getCategories().isEmpty())
                ? convertCategoriesToEntities(request.getCategories())
                : new ArrayList<>();

        // 3. 天気情報の設定（ユーザー入力があればそのまま使用、なければnull）
        LocalDateTime takenAt = LocalDateTime.parse(request.getTakenAt(), DateTimeFormatter.ISO_DATE_TIME);
        String weather = request.getWeather();
        if (weather != null && weather.isBlank()) {
            weather = null;
        }

        // 4. 写真の保存
        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(user.getId());
        photo.setS3ObjectKey(request.getS3ObjectKey());
        photo.setTitle(request.getTitle());
        photo.setPlaceName(request.getPlaceName());
        photo.setShotAt(takenAt);
        photo.setWeather(weather);
        photo.setTimeOfDay(calculateTimeOfDay(takenAt));
        photo.setCategories(categories);
        photo.setLatitude(request.getLatitude());
        photo.setLongitude(request.getLongitude());
        photo.setDeviceType(request.getDeviceType());
        photo.setCameraBody(request.getCameraBody());
        photo.setCameraLens(request.getCameraLens());
        photo.setFocalLength35mm(request.getFocalLength35mm());
        photo.setFValue(request.getFValue());
        photo.setShutterSpeed(request.getShutterSpeed());
        photo.setIso(request.getIso());
        photo.setImageWidth(request.getImageWidth());
        photo.setImageHeight(request.getImageHeight());
        photo.setCropCenterX(request.getCropCenterX());
        photo.setCropCenterY(request.getCropCenterY());
        photo.setCropZoom(request.getCropZoom());

        Photo savedPhoto = photoRepository.save(photo);

        logger.info("写真を投稿しました: photoId={}, userId={}, spotId={}",
                   savedPhoto.getPhotoId(), user.getId(), spot.getSpotId());

        // 5. レスポンスの構築（新規投稿なのでis_favoritedはfalse）
        return buildPhotoResponse(savedPhoto, spot, user, false);
    }

    /**
     * 写真詳細を取得する
     *
     * @param photoId 写真ID
     * @param email ログイン中ユーザーのメールアドレス（未認証の場合はnull）
     * @return 写真の詳細情報
     */
    @Transactional(readOnly = true)
    public PhotoResponse getPhotoDetail(Long photoId, String email) {
        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND));

        // Issue#54: モデレーションステータスによるアクセス制御
        User currentUser = (email != null) ? userRepository.findByEmail(email).orElse(null) : null;
        validatePhotoVisibility(photo, currentUser);

        Spot spot = spotRepository.findById(photo.getSpotId())
                .orElseThrow(() -> new SpotNotFoundException(ERROR_SPOT_NOT_FOUND));

        User user = userRepository.findById(photo.getUserId())
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

        // Issue#72: 退会済みユーザーの写真は非公開
        if (user.getDeletedAt() != null) {
            throw new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND);
        }

        // お気に入り状態をチェック
        boolean isFavorited = false;
        if (currentUser != null) {
            isFavorited = favoriteRepository.findByUserIdAndPhotoId(currentUser.getId(), photoId).isPresent();
        }

        // Issue#30: お気に入り数を取得
        long favoriteCount = favoriteRepository.countByPhotoId(photoId);

        return buildPhotoResponse(photo, spot, user, isFavorited, favoriteCount);
    }


    /**
     * ユーザーの投稿写真一覧を取得する（ページネーション対応）
     *
     * @param userId 対象ユーザーのID
     * @param pageable ページネーション情報
     * @param email ログイン中ユーザーのメールアドレス（未認証の場合はnull）
     * @return ページネーション情報を含む写真一覧レスポンス
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getUserPhotos(Long userId, Pageable pageable, String email) {
        // ログインユーザー情報を取得
        User currentUser = null;
        if (email != null) {
            currentUser = userRepository.findByEmail(email).orElse(null);
        }

        // Issue#54: モデレーションステータスによるフィルタリング
        Collection<ModerationStatus> visibleStatuses = getVisibleStatuses(userId, currentUser);
        Page<Photo> photoPage = photoRepository.findByUserIdAndModerationStatusInOrderByCreatedAtDesc(
                userId, visibleStatuses, pageable);

        final User finalCurrentUser = currentUser;

        Page<PhotoResponse> photoResponses = photoPage.map(photo -> {
            Spot spot = spotRepository.findById(photo.getSpotId())
                    .orElseThrow(() -> new SpotNotFoundException(ERROR_SPOT_NOT_FOUND));
            User photoUser = userRepository.findById(photo.getUserId())
                    .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

            boolean isFavorited = false;
            if (finalCurrentUser != null) {
                isFavorited = favoriteRepository.findByUserIdAndPhotoId(
                        finalCurrentUser.getId(), photo.getPhotoId()).isPresent();
            }
            long favoriteCount = favoriteRepository.countByPhotoId(photo.getPhotoId());

            return buildPhotoResponse(photo, spot, photoUser, isFavorited, favoriteCount);
        });

        Map<String, Object> response = new HashMap<>();
        response.put("content", photoResponses.getContent());

        Map<String, Object> pageableInfo = new HashMap<>();
        pageableInfo.put("page_number", photoResponses.getNumber());
        pageableInfo.put("page_size", photoResponses.getSize());
        response.put("pageable", pageableInfo);

        response.put("total_pages", photoResponses.getTotalPages());
        response.put("total_elements", photoResponses.getTotalElements());
        response.put("last", photoResponses.isLast());

        return response;
    }

    /**
     * Issue#54: 投稿者本人用に写真を取得する（ポーリング用）
     * 投稿者本人でない場合は例外をスロー
     *
     * @param photoId 写真ID
     * @param userId ユーザーID
     * @return 写真エンティティ
     * @throws PhotoNotFoundException 写真が見つからないか、投稿者でない場合
     */
    @Transactional(readOnly = true)
    public Photo getPhotoForOwner(Long photoId, Long userId) {
        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND));

        if (!photo.getUserId().equals(userId)) {
            throw new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND);
        }

        return photo;
    }

    /**
     * Issue#57: ユーザーが自分の写真を削除する（ソフトデリート）
     *
     * @param photoId 写真ID
     * @param email ログイン中ユーザーのメールアドレス
     * @throws PhotoNotFoundException 写真が見つからないか、既にREMOVEDの場合
     * @throws org.springframework.security.access.AccessDeniedException オーナーでない場合
     */
    @Transactional
    public void deletePhoto(Long photoId, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND));

        if (photo.getModerationStatus() == ModerationStatus.REMOVED) {
            throw new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND);
        }

        if (!photo.getUserId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("この写真を削除する権限がありません");
        }

        // 関連レコードの削除
        photoCategoryRepository.deleteByPhotoId(photoId);
        reportRepository.deleteByTargetTypeAndTargetId(ReportTargetType.PHOTO, photoId);
        moderationDetailRepository.deleteByTargetTypeAndTargetId(ReportTargetType.PHOTO, photoId);

        // ソフトデリート
        photo.setModerationStatus(ModerationStatus.REMOVED);
        photoRepository.save(photo);

        logger.info("写真を削除しました: photoId={}, userId={}", photoId, user.getId());
    }

    /**
     * Issue#61: 写真メタデータを更新する
     *
     * @param photoId 写真ID
     * @param request 更新リクエスト
     * @param email ログイン中ユーザーのメールアドレス
     * @return 更新後の写真詳細レスポンス
     * @throws PhotoNotFoundException 写真が見つからないか、既にREMOVEDの場合
     * @throws org.springframework.security.access.AccessDeniedException オーナーでない場合
     */
    @Transactional
    public PhotoResponse updatePhoto(Long photoId, UpdatePhotoRequest request, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND));

        if (photo.getModerationStatus() == ModerationStatus.REMOVED) {
            throw new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND);
        }

        if (!photo.getUserId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("この写真を編集する権限がありません");
        }

        // タイトル変更の判定
        boolean isTitleChanged = request.getTitle() != null
                && !request.getTitle().equals(photo.getTitle());

        // フィールド更新
        if (request.getTitle() != null) {
            photo.setTitle(request.getTitle());
        }
        if (request.getWeather() != null) {
            photo.setWeather(request.getWeather());
        }
        if (request.getPlaceName() != null) {
            photo.setPlaceName(request.getPlaceName());
        }
        if (request.getCategories() != null) {
            List<Category> categories = convertCategoriesToEntities(request.getCategories());
            photo.setCategories(categories);
        }

        // タイトル変更時は再モデレーション
        if (isTitleChanged) {
            photo.setModerationStatus(ModerationStatus.PENDING_REVIEW);
        }

        Photo savedPhoto = photoRepository.save(photo);

        Spot spot = spotRepository.findById(photo.getSpotId())
                .orElseThrow(() -> new SpotNotFoundException(ERROR_SPOT_NOT_FOUND));

        logger.info("写真を更新しました: photoId={}, userId={}, titleChanged={}",
                photoId, user.getId(), isTitleChanged);

        return buildPhotoResponse(savedPhoto, spot, user, false, 0L);
    }

    /**
     * スポットを検索または新規作成する
     * 半径200m以内に既存スポットがあれば最も近いものを返し、なければ新規作成する
     */
    private Spot findOrCreateSpot(CreatePhotoRequest request, User user) {
        List<Spot> nearbySpots = spotRepository.findSpotsWithin200m(
                request.getLatitude(),
                request.getLongitude()
        );

        if (!nearbySpots.isEmpty()) {
            // 最も近いスポット（先頭）を返す
            Spot closestSpot = nearbySpots.get(0);
            logger.info("既存スポットを使用: spotId={}", closestSpot.getSpotId());
            return closestSpot;
        } else {
            // 新規スポットを作成
            Spot newSpot = new Spot();
            newSpot.setLatitude(request.getLatitude());
            newSpot.setLongitude(request.getLongitude());
            newSpot.setCreatedByUserId(user.getId());

            Spot savedSpot = spotRepository.save(newSpot);
            logger.info("新規スポットを作成: spotId={}", savedSpot.getSpotId());
            return savedSpot;
        }
    }

    /**
     * カテゴリ名のリストをCategoryエンティティのリストに変換する
     * 存在しないカテゴリ名があれば例外をスローする
     */
    private List<Category> convertCategoriesToEntities(List<String> categoryNames) {
        List<Category> categories = new ArrayList<>();

        for (String categoryName : categoryNames) {
            Category category = categoryRepository.findByName(categoryName)
                    .orElseThrow(() -> new CategoryNotFoundException(
                            "カテゴリが見つかりません: " + categoryName
                    ));
            categories.add(category);
        }

        return categories;
    }

    /**
     * PhotoResponseを構築する
     */
    private PhotoResponse buildPhotoResponse(Photo photo, Spot spot, User user, boolean isFavorited) {
        return buildPhotoResponse(photo, spot, user, isFavorited, 0L);
    }

    private PhotoResponse buildPhotoResponse(Photo photo, Spot spot, User user, boolean isFavorited, long favoriteCount) {
        // S3オブジェクトキーからCDN URLを生成
        String imageUrl = s3Service.generateCdnUrl(photo.getS3ObjectKey());

        PhotoResponse.PhotoDTO photoDTO = new PhotoResponse.PhotoDTO(
                photo.getPhotoId(),
                photo.getTitle(),
                imageUrl,
                photo.getShotAt().format(DateTimeFormatter.ISO_DATE_TIME),
                photo.getWeather(),
                isFavorited,
                favoriteCount
        );

        // 施設名・店名を設定
        photoDTO.setPlaceName(photo.getPlaceName());

        // ピンポイント座標を設定
        photoDTO.setLatitude(photo.getLatitude());
        photoDTO.setLongitude(photo.getLongitude());

        // クロップ情報を設定
        photoDTO.setCropCenterX(photo.getCropCenterX());
        photoDTO.setCropCenterY(photo.getCropCenterY());
        photoDTO.setCropZoom(photo.getCropZoom());

        // Issue#54: モデレーションステータスを設定
        if (photo.getModerationStatus() != null) {
            photoDTO.setModerationStatus(photo.getModerationStatus().name());
        }

        // Issue#59: サムネイルURLを設定
        photoDTO.setThumbnailUrl(s3Service.generateThumbnailCdnUrl(photo.getS3ObjectKey()));

        // EXIF情報を設定（1つでも値があればExifDTOを生成）
        PhotoResponse.ExifDTO exifDTO = buildExifDTO(photo);
        photoDTO.setExif(exifDTO);

        PhotoResponse.SpotDTO spotDTO = new PhotoResponse.SpotDTO(
                spot.getSpotId(),
                spot.getLatitude(),
                spot.getLongitude()
        );

        PhotoResponse.UserDTO userDTO = new PhotoResponse.UserDTO(
                user.getId(),
                user.getUsername()
        );

        return new PhotoResponse(photoDTO, spotDTO, userDTO);
    }

    /**
     * Issue#54: 写真の閲覧権限を検証する
     * REMOVED: 誰も閲覧不可
     * PENDING_REVIEW, QUARANTINED: 投稿者本人のみ閲覧可能
     * PUBLISHED: 誰でも閲覧可能
     *
     * @param photo 対象の写真
     * @param currentUser リクエスト者（未認証の場合はnull）
     * @throws PhotoNotFoundException 閲覧権限がない場合
     */
    private void validatePhotoVisibility(Photo photo, User currentUser) {
        ModerationStatus status = photo.getModerationStatus();

        if (status == ModerationStatus.REMOVED) {
            throw new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND);
        }

        if (status == ModerationStatus.PENDING_REVIEW || status == ModerationStatus.QUARANTINED) {
            boolean isOwner = currentUser != null && currentUser.getId().equals(photo.getUserId());
            if (!isOwner) {
                throw new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND);
            }
        }
    }

    /**
     * Issue#54: リクエスト者に対して表示可能なモデレーションステータスを返す
     *
     * @param targetUserId 対象ユーザーのID
     * @param currentUser リクエスト者（未認証の場合はnull）
     * @return 表示可能なステータスのコレクション
     */
    private Collection<ModerationStatus> getVisibleStatuses(Long targetUserId, User currentUser) {
        if (currentUser != null && currentUser.getId().equals(targetUserId)) {
            // 投稿者本人: PENDING_REVIEW, PUBLISHED, QUARANTINED が閲覧可能
            return List.of(ModerationStatus.PENDING_REVIEW, ModerationStatus.PUBLISHED, ModerationStatus.QUARANTINED);
        }
        // 他ユーザー・未認証: PUBLISHEDのみ
        return List.of(ModerationStatus.PUBLISHED);
    }

    /**
     * Issue#54: アカウントが停止されていないか検証する
     * 永久停止またはアクティブな一時停止中の場合は例外をスローする
     *
     * @param user ユーザー
     * @throws AccountSuspendedException アカウント停止中の場合
     */
    private void validateAccountNotSuspended(User user) {
        // 永久停止チェック
        if (ROLE_SUSPENDED.equals(user.getRole())) {
            throw new AccountSuspendedException("アカウントが停止されています");
        }

        // 一時停止チェック
        List<AccountSanction> sanctions = accountSanctionRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        for (AccountSanction sanction : sanctions) {
            if ("TEMPORARY_SUSPENSION".equals(sanction.getSanctionType())
                    && sanction.getSuspendedUntil() != null
                    && sanction.getSuspendedUntil().isAfter(LocalDateTime.now())) {
                throw new AccountSuspendedException(
                        "投稿機能が一時停止中です（" + sanction.getSuspendedUntil().toLocalDate() + " まで）");
            }
        }
    }

    /**
     * 撮影日時から時間帯を自動判定する
     *
     * @param shotAt 撮影日時（nullの場合はnullを返す）
     * @return 時間帯（MORNING/DAY/EVENING/NIGHT）
     */
    private String calculateTimeOfDay(LocalDateTime shotAt) {
        if (shotAt == null) {
            return null;
        }
        int hour = shotAt.getHour();
        if (hour >= 5 && hour <= 9) {
            return "MORNING";
        } else if (hour >= 10 && hour <= 15) {
            return "DAY";
        } else if (hour >= 16 && hour <= 17) {
            return "EVENING";
        } else {
            return "NIGHT";
        }
    }

    /**
     * Photo エンティティからExifDTOを構築する
     * EXIF情報が全てnullの場合はnullを返す
     */
    private PhotoResponse.ExifDTO buildExifDTO(Photo photo) {
        boolean hasAnyExif = photo.getCameraBody() != null
                || photo.getCameraLens() != null
                || photo.getFocalLength35mm() != null
                || photo.getFValue() != null
                || photo.getShutterSpeed() != null
                || photo.getIso() != null
                || photo.getImageWidth() != null
                || photo.getImageHeight() != null;

        if (!hasAnyExif) {
            return null;
        }

        PhotoResponse.ExifDTO exifDTO = new PhotoResponse.ExifDTO();
        exifDTO.setCameraBody(photo.getCameraBody());
        exifDTO.setCameraLens(photo.getCameraLens());
        exifDTO.setFocalLength35mm(photo.getFocalLength35mm());
        exifDTO.setFValue(photo.getFValue());
        exifDTO.setShutterSpeed(photo.getShutterSpeed());
        exifDTO.setIso(photo.getIso());
        exifDTO.setImageWidth(photo.getImageWidth());
        exifDTO.setImageHeight(photo.getImageHeight());
        return exifDTO;
    }

}
