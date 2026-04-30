package com.photlas.backend.service;

import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.PhotoDetailResponse;
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
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.photlas.backend.entity.CodeConstants;

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

        // S3ファイル存在確認
        if (!s3Service.existsInS3(request.getS3ObjectKey())) {
            throw new IllegalArgumentException("S3上にファイルが存在しません: " + request.getS3ObjectKey());
        }

        // 1. スポットの集約と作成
        Spot spot = findOrCreateSpot(request, user);

        // 2. カテゴリの変換（任意項目）
        List<Category> categories = (request.getCategories() != null && !request.getCategories().isEmpty())
                ? convertCategoriesToEntities(request.getCategories())
                : new ArrayList<>();

        // 3. 天気情報の設定（ユーザー入力があればそのまま使用、なければnull）
        LocalDateTime takenAt = LocalDateTime.parse(request.getTakenAt(), DateTimeFormatter.ISO_DATE_TIME);
        Integer weather = request.getWeather();

        // Issue#100: DB 保存の前に元画像のタグを registered に更新する。
        // タグ更新が失敗した場合は DB 保存を行わずエラーを返す
        // （ファイルが pending タグのまま残れば、ライフサイクルルールで自動削除される）。
        s3Service.updateObjectTag(
                request.getS3ObjectKey(),
                S3Service.STATUS_TAG_KEY,
                S3Service.STATUS_TAG_VALUE_REGISTERED);

        // 4. 写真の保存
        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(user.getId());
        photo.setS3ObjectKey(request.getS3ObjectKey());
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

        // Issue#100: サムネイルのタグもベストエフォートで registered に更新する。
        // Lambda が先にサムネイルを生成済みであれば即座に追従し、まだ未生成なら本処理は失敗するが
        // その場合は Lambda 側が二重チェック方式で源画像の registered タグをコピーする。
        String thumbnailKey = deriveThumbnailKey(request.getS3ObjectKey());
        try {
            s3Service.updateObjectTag(
                    thumbnailKey,
                    S3Service.STATUS_TAG_KEY,
                    S3Service.STATUS_TAG_VALUE_REGISTERED);
        } catch (Exception e) {
            logger.info("サムネイルのタグ更新をスキップ（未生成または一時エラー）: thumbnailKey={}, reason={}",
                       thumbnailKey, e.getMessage());
        }

        // 5. レスポンスの構築（新規投稿なのでis_favoritedはfalse）
        return buildPhotoResponse(savedPhoto, spot, user, false);
    }

    /**
     * Issue#100: 元画像 S3 キーからサムネイル S3 キーを導出する。
     * 命名規則: uploads/1/abc.jpg → thumbnails/uploads/1/abc.webp
     */
    private String deriveThumbnailKey(String originalKey) {
        if (originalKey == null) {
            return null;
        }
        int dotIndex = originalKey.lastIndexOf('.');
        String baseName = dotIndex > 0 ? originalKey.substring(0, dotIndex) : originalKey;
        return "thumbnails/" + baseName + ".webp";
    }

    /**
     * 写真詳細を取得する
     *
     * @param photoId 写真ID
     * @param email ログイン中ユーザーのメールアドレス（未認証の場合はnull）
     * @return 写真の詳細情報
     */
    @Transactional(readOnly = true)
    public PhotoDetailResponse getPhotoDetail(Long photoId, String email) {
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

        return buildPhotoDetailResponse(photo, spot, user, isFavorited, favoriteCount);
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
        Collection<Integer> visibleStatuses = getVisibleStatuses(userId, currentUser);
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

        if (Integer.valueOf(CodeConstants.MODERATION_STATUS_REMOVED).equals(photo.getModerationStatus())) {
            throw new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND);
        }

        if (!photo.getUserId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("この写真を削除する権限がありません");
        }

        // 関連レコードの削除
        photoCategoryRepository.deleteByPhotoId(photoId);
        reportRepository.deleteByTargetTypeAndTargetId(CodeConstants.TARGET_TYPE_PHOTO, photoId);
        moderationDetailRepository.deleteByTargetTypeAndTargetId(CodeConstants.TARGET_TYPE_PHOTO, photoId);

        // ソフトデリート
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_REMOVED);
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
    public PhotoDetailResponse updatePhoto(Long photoId, UpdatePhotoRequest request, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND));

        if (Integer.valueOf(CodeConstants.MODERATION_STATUS_REMOVED).equals(photo.getModerationStatus())) {
            throw new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND);
        }

        if (!photo.getUserId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("この写真を編集する権限がありません");
        }

        // フィールド更新
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

        Photo savedPhoto = photoRepository.save(photo);

        Spot spot = spotRepository.findById(photo.getSpotId())
                .orElseThrow(() -> new SpotNotFoundException(ERROR_SPOT_NOT_FOUND));

        logger.info("写真を更新しました: photoId={}, userId={}", photoId, user.getId());

        return buildPhotoDetailResponse(savedPhoto, spot, user, false, 0L);
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

    /**
     * コンテンツポリシー違反によりブロックされた写真かどうかを判定する
     */
    private boolean isBlockedContent(Photo photo) {
        return CodeConstants.isBlockedContent(photo.getModerationStatus());
    }

    private PhotoResponse buildPhotoResponse(Photo photo, Spot spot, User user, boolean isFavorited, long favoriteCount) {
        boolean isBlocked = isBlockedContent(photo);
        String imageUrl = isBlocked
                ? s3Service.generateCdnUrl(CodeConstants.BLOCKED_CONTENT_IMAGE_KEY)
                : s3Service.generateCdnUrl(photo.getS3ObjectKey());

        PhotoResponse.PhotoDTO photoDTO = new PhotoResponse.PhotoDTO(
                photo.getPhotoId(),
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
            photoDTO.setModerationStatus(photo.getModerationStatus());
        }

        // Issue#59: サムネイルURLを設定（ブロック時は黒色画像）
        photoDTO.setThumbnailUrl(isBlocked
                ? s3Service.generateCdnUrl(CodeConstants.BLOCKED_CONTENT_IMAGE_KEY)
                : s3Service.generateThumbnailCdnUrl(photo.getS3ObjectKey()));

        // カテゴリ名リストを設定
        if (photo.getCategories() != null && !photo.getCategories().isEmpty()) {
            photoDTO.setCategories(
                photo.getCategories().stream()
                    .map(Category::getName)
                    .collect(Collectors.toList())
            );
        }

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
        if (user.getProfileImageS3Key() != null) {
            userDTO.setProfileImageUrl(s3Service.generateCdnUrl(user.getProfileImageS3Key()));
        }

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
        Integer status = photo.getModerationStatus();

        if (Integer.valueOf(CodeConstants.MODERATION_STATUS_REMOVED).equals(status)) {
            throw new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND);
        }

        if (Integer.valueOf(CodeConstants.MODERATION_STATUS_PENDING_REVIEW).equals(status)
                || Integer.valueOf(CodeConstants.MODERATION_STATUS_QUARANTINED).equals(status)) {
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
    private Collection<Integer> getVisibleStatuses(Long targetUserId, User currentUser) {
        if (currentUser != null && currentUser.getId().equals(targetUserId)) {
            // 投稿者本人: PENDING_REVIEW, PUBLISHED, QUARANTINED が閲覧可能
            return List.of(CodeConstants.MODERATION_STATUS_PENDING_REVIEW, CodeConstants.MODERATION_STATUS_PUBLISHED, CodeConstants.MODERATION_STATUS_QUARANTINED);
        }
        // 他ユーザー・未認証: PUBLISHEDのみ
        return List.of(CodeConstants.MODERATION_STATUS_PUBLISHED);
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
        if (Integer.valueOf(CodeConstants.ROLE_SUSPENDED).equals(user.getRole())) {
            throw new AccountSuspendedException("アカウントが停止されています");
        }

        // 一時停止チェック
        List<AccountSanction> sanctions = accountSanctionRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        for (AccountSanction sanction : sanctions) {
            if (Integer.valueOf(CodeConstants.SANCTION_TEMPORARY_SUSPENSION).equals(sanction.getSanctionType())
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
     * @return 時間帯の数値コード（CodeConstants.TIME_OF_DAY_*）
     */
    private Integer calculateTimeOfDay(LocalDateTime shotAt) {
        if (shotAt == null) {
            return null;
        }
        int hour = shotAt.getHour();
        if (hour >= 5 && hour <= 9) {
            return CodeConstants.TIME_OF_DAY_MORNING;
        } else if (hour >= 10 && hour <= 15) {
            return CodeConstants.TIME_OF_DAY_DAY;
        } else if (hour >= 16 && hour <= 17) {
            return CodeConstants.TIME_OF_DAY_EVENING;
        } else {
            return CodeConstants.TIME_OF_DAY_NIGHT;
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

    /**
     * Issue#88: PhotoDetailResponseを構築する
     *
     * @param photo 写真エンティティ
     * @param spot スポットエンティティ
     * @param user ユーザーエンティティ
     * @param isFavorited リクエスト者がお気に入り登録しているか
     * @param favoriteCount お気に入り数
     * @return 写真詳細レスポンス
     */
    private PhotoDetailResponse buildPhotoDetailResponse(Photo photo, Spot spot, User user,
                                                          boolean isFavorited, long favoriteCount) {
        boolean isBlocked = isBlockedContent(photo);

        String standardUrl = isBlocked
                ? s3Service.generateCdnUrl(CodeConstants.BLOCKED_CONTENT_IMAGE_KEY)
                : s3Service.generateCdnUrl(photo.getS3ObjectKey());
        String thumbnailUrl = isBlocked
                ? s3Service.generateCdnUrl(CodeConstants.BLOCKED_CONTENT_IMAGE_KEY)
                : s3Service.generateThumbnailCdnUrl(photo.getS3ObjectKey());

        PhotoDetailResponse response = new PhotoDetailResponse();
        response.setPhotoId(photo.getPhotoId());
        response.setImageUrls(new PhotoDetailResponse.ImageUrls(thumbnailUrl, standardUrl, standardUrl));
        response.setPlaceName(photo.getPlaceName());
        response.setShotAt(photo.getShotAt());
        response.setWeather(photo.getWeather());
        response.setIsFavorited(isFavorited);
        response.setFavoriteCount(favoriteCount);
        response.setLatitude(photo.getLatitude());
        response.setLongitude(photo.getLongitude());
        response.setCropCenterX(photo.getCropCenterX());
        response.setCropCenterY(photo.getCropCenterY());
        response.setCropZoom(photo.getCropZoom());
        response.setModerationStatus(photo.getModerationStatus());

        if (photo.getCategories() != null && !photo.getCategories().isEmpty()) {
            response.setCategories(
                photo.getCategories().stream()
                    .map(Category::getName)
                    .collect(Collectors.toList())
            );
        }

        response.setCameraInfo(buildCameraInfo(photo));

        PhotoDetailResponse.UserInfo userInfo = new PhotoDetailResponse.UserInfo();
        userInfo.setUserId(user.getId());
        userInfo.setUsername(user.getUsername());
        if (user.getProfileImageS3Key() != null) {
            userInfo.setProfileImageUrl(s3Service.generateCdnUrl(user.getProfileImageS3Key()));
        }
        response.setUser(userInfo);

        response.setSpot(new PhotoDetailResponse.SpotInfo(spot.getSpotId(), spot.getLatitude(), spot.getLongitude()));

        return response;
    }

    /**
     * Issue#88: Photo エンティティからCameraInfoを構築する
     * カメラ情報が全てnullの場合はnullを返す
     */
    private PhotoDetailResponse.CameraInfo buildCameraInfo(Photo photo) {
        boolean hasAnyCameraInfo = photo.getCameraBody() != null
                || photo.getCameraLens() != null
                || photo.getFocalLength35mm() != null
                || photo.getFValue() != null
                || photo.getShutterSpeed() != null
                || photo.getIso() != null
                || photo.getImageWidth() != null
                || photo.getImageHeight() != null;

        if (!hasAnyCameraInfo) {
            return null;
        }

        PhotoDetailResponse.CameraInfo cameraInfo = new PhotoDetailResponse.CameraInfo();
        cameraInfo.setBody(photo.getCameraBody());
        cameraInfo.setLens(photo.getCameraLens());
        cameraInfo.setFocalLength35mm(photo.getFocalLength35mm());
        cameraInfo.setFValue(photo.getFValue());
        cameraInfo.setShutterSpeed(photo.getShutterSpeed());
        cameraInfo.setIso(photo.getIso() != null ? String.valueOf(photo.getIso()) : null);
        cameraInfo.setImageWidth(photo.getImageWidth());
        cameraInfo.setImageHeight(photo.getImageHeight());

        return cameraInfo;
    }

}
