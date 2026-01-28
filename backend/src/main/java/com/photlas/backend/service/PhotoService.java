package com.photlas.backend.service;

import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.CategoryNotFoundException;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.exception.SpotNotFoundException;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.CategoryRepository;
import com.photlas.backend.repository.FavoriteRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

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
    private final UserRepository userRepository;
    private final WeatherService weatherService;
    private final FavoriteRepository favoriteRepository;
    private final S3Service s3Service;

    public PhotoService(
            PhotoRepository photoRepository,
            SpotRepository spotRepository,
            CategoryRepository categoryRepository,
            UserRepository userRepository,
            WeatherService weatherService,
            FavoriteRepository favoriteRepository,
            S3Service s3Service
    ) {
        this.photoRepository = photoRepository;
        this.spotRepository = spotRepository;
        this.categoryRepository = categoryRepository;
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

        // 2. カテゴリの変換
        List<Category> categories = convertCategoriesToEntities(request.getCategories());

        // 3. 天気情報の取得
        LocalDateTime takenAt = LocalDateTime.parse(request.getTakenAt(), DateTimeFormatter.ISO_DATE_TIME);
        String weather = weatherService.getWeather(request.getLatitude(), request.getLongitude(), takenAt);

        // 4. 写真の保存
        Photo photo = new Photo();
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(user.getId());
        photo.setS3ObjectKey(request.getS3ObjectKey());
        photo.setTitle(request.getTitle());
        photo.setShotAt(takenAt);
        photo.setWeather(weather);
        photo.setCategories(categories);

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

}
