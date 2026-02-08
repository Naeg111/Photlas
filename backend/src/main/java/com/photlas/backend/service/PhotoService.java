package com.photlas.backend.service;

import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.Tag;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.CategoryNotFoundException;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.exception.SpotNotFoundException;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.FavoriteRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.TagRepository;
import com.photlas.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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

    private final PhotoRepository photoRepository;
    private final SpotRepository spotRepository;
    private final CategoryRepository categoryRepository;
    private final TagRepository tagRepository;
    private final UserRepository userRepository;
    private final WeatherService weatherService;
    private final FavoriteRepository favoriteRepository;
    private final S3Service s3Service;

    public PhotoService(
            PhotoRepository photoRepository,
            SpotRepository spotRepository,
            CategoryRepository categoryRepository,
            TagRepository tagRepository,
            UserRepository userRepository,
            WeatherService weatherService,
            FavoriteRepository favoriteRepository,
            S3Service s3Service
    ) {
        this.photoRepository = photoRepository;
        this.spotRepository = spotRepository;
        this.categoryRepository = categoryRepository;
        this.tagRepository = tagRepository;
        this.userRepository = userRepository;
        this.weatherService = weatherService;
        this.favoriteRepository = favoriteRepository;
        this.s3Service = s3Service;
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
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません"));

        // 1. スポットの集約と作成
        Spot spot = findOrCreateSpot(request, user);

        // 2. カテゴリの変換（任意項目）
        List<Category> categories = (request.getCategories() != null && !request.getCategories().isEmpty())
                ? convertCategoriesToEntities(request.getCategories())
                : new ArrayList<>();

        // 3. 天気情報の取得（ユーザー入力を優先、なければweatherServiceで取得）
        LocalDateTime takenAt = LocalDateTime.parse(request.getTakenAt(), DateTimeFormatter.ISO_DATE_TIME);
        String weather = request.getWeather();
        if (weather == null || weather.isBlank()) {
            weather = weatherService.getWeather(request.getLatitude(), request.getLongitude(), takenAt);
        }

        // 3.5. タグの変換（find-or-create）
        List<Tag> tags = (request.getTags() != null && !request.getTags().isEmpty())
                ? convertTagsToEntities(request.getTags())
                : new ArrayList<>();

        // 4. 写真の保存
        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(user.getId());
        photo.setS3ObjectKey(request.getS3ObjectKey());
        photo.setTitle(request.getTitle());
        photo.setShotAt(takenAt);
        photo.setWeather(weather);
        photo.setCategories(categories);
        photo.setLatitude(request.getLatitude());
        photo.setLongitude(request.getLongitude());
        photo.setShootingDirection(request.getShootingDirection());
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
        photo.setTags(tags);

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
                .orElseThrow(() -> new PhotoNotFoundException("写真が見つかりません"));

        Spot spot = spotRepository.findById(photo.getSpotId())
                .orElseThrow(() -> new SpotNotFoundException("スポットが見つかりません"));

        User user = userRepository.findById(photo.getUserId())
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません"));

        // お気に入り状態をチェック
        boolean isFavorited = false;
        if (email != null) {
            User currentUser = userRepository.findByEmail(email).orElse(null);
            if (currentUser != null) {
                isFavorited = favoriteRepository.findByUserIdAndPhotoId(currentUser.getId(), photoId).isPresent();
            }
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
        Page<Photo> photoPage = photoRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);

        // ログインユーザー情報を取得（お気に入り判定用）
        User currentUser = null;
        if (email != null) {
            currentUser = userRepository.findByEmail(email).orElse(null);
        }
        final User finalCurrentUser = currentUser;

        Page<PhotoResponse> photoResponses = photoPage.map(photo -> {
            Spot spot = spotRepository.findById(photo.getSpotId())
                    .orElseThrow(() -> new SpotNotFoundException("スポットが見つかりません"));
            User photoUser = userRepository.findById(photo.getUserId())
                    .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません"));

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
     * タグ名のリストをTagエンティティのリストに変換する
     * 既存のタグがあれば再利用し、なければ新規作成する
     */
    private List<Tag> convertTagsToEntities(List<String> tagNames) {
        List<Tag> tags = new ArrayList<>();

        for (String tagName : tagNames) {
            String trimmedName = tagName.trim();
            if (trimmedName.isEmpty()) {
                continue;
            }
            Tag tag = tagRepository.findByName(trimmedName)
                    .orElseGet(() -> {
                        Tag newTag = new Tag();
                        newTag.setName(trimmedName);
                        return tagRepository.save(newTag);
                    });
            tags.add(tag);
        }

        return tags;
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

        // ピンポイント座標と撮影方向を設定
        photoDTO.setLatitude(photo.getLatitude());
        photoDTO.setLongitude(photo.getLongitude());
        photoDTO.setShootingDirection(photo.getShootingDirection());

        // クロップ情報を設定
        photoDTO.setCropCenterX(photo.getCropCenterX());
        photoDTO.setCropCenterY(photo.getCropCenterY());
        photoDTO.setCropZoom(photo.getCropZoom());

        // EXIF情報を設定（1つでも値があればExifDTOを生成）
        PhotoResponse.ExifDTO exifDTO = buildExifDTO(photo);
        photoDTO.setExif(exifDTO);

        // タグ情報を設定
        List<PhotoResponse.TagDTO> tagDTOs = photo.getTags().stream()
                .map(tag -> new PhotoResponse.TagDTO(tag.getTagId(), tag.getName()))
                .toList();
        photoDTO.setTags(tagDTOs);

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
