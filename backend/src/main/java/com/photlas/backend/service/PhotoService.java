package com.photlas.backend.service;

import com.photlas.backend.dto.CreatePhotoRequest;
import com.photlas.backend.dto.PhotoDetailResponse;
import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.entity.Category;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.CategoryNotFoundException;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.repository.CategoryRepository;
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

@Service
public class PhotoService {

    private static final Logger logger = LoggerFactory.getLogger(PhotoService.class);

    private final PhotoRepository photoRepository;
    private final SpotRepository spotRepository;
    private final CategoryRepository categoryRepository;
    private final UserRepository userRepository;
    private final WeatherService weatherService;

    @Value("${aws.s3.bucket-name:photlas-photos}")
    private String bucketName;

    @Value("${aws.s3.region:ap-northeast-1}")
    private String region;

    public PhotoService(
            PhotoRepository photoRepository,
            SpotRepository spotRepository,
            CategoryRepository categoryRepository,
            UserRepository userRepository,
            WeatherService weatherService
    ) {
        this.photoRepository = photoRepository;
        this.spotRepository = spotRepository;
        this.categoryRepository = categoryRepository;
        this.userRepository = userRepository;
        this.weatherService = weatherService;
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
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

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

        // 5. レスポンスの構築
        return buildPhotoResponse(savedPhoto, spot, user);
    }

    /**
     * Issue#14: 写真詳細情報を取得
     *
     * @param photoId 写真ID
     * @return 写真詳細情報
     */
    @Transactional(readOnly = true)
    public PhotoDetailResponse getPhotoDetail(Long photoId) {
        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new PhotoNotFoundException("Photo not found"));

        User user = userRepository.findById(photo.getUserId())
                .orElseThrow(() -> new RuntimeException("User not found"));

        PhotoDetailResponse response = new PhotoDetailResponse();
        response.setPhotoId(photo.getPhotoId());
        response.setTitle(photo.getTitle());
        response.setImageUrls(createImageUrls(photo.getS3ObjectKey()));
        response.setShotAt(photo.getShotAt());
        response.setWeather(photo.getWeather());
        response.setTimeOfDay(photo.getTimeOfDay());
        response.setSubjectCategory(photo.getSubjectCategory());
        response.setCameraInfo(createCameraInfo(photo));
        response.setUser(createUserInfo(user));
        response.setSpot(new PhotoDetailResponse.SpotInfo(photo.getSpotId()));

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
     * PhotoResponseを構築する
     */
    private PhotoResponse buildPhotoResponse(Photo photo, Spot spot, User user) {
        PhotoResponse.PhotoDTO photoDTO = new PhotoResponse.PhotoDTO(
                photo.getPhotoId(),
                photo.getTitle(),
                photo.getS3ObjectKey(),
                photo.getShotAt().format(DateTimeFormatter.ISO_DATE_TIME),
                photo.getWeather()
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

    /**
     * Issue#14: S3画像URLを生成する
     */
    private PhotoDetailResponse.ImageUrls createImageUrls(String s3ObjectKey) {
        String baseUrl = String.format("https://%s.s3.%s.amazonaws.com/photos", bucketName, region);
        return new PhotoDetailResponse.ImageUrls(
            baseUrl + "/thumbnail/" + s3ObjectKey,
            baseUrl + "/standard/" + s3ObjectKey,
            baseUrl + "/original/" + s3ObjectKey
        );
    }

    /**
     * Issue#14: カメラ情報オブジェクトを生成する
     */
    private PhotoDetailResponse.CameraInfo createCameraInfo(Photo photo) {
        return new PhotoDetailResponse.CameraInfo(
            photo.getCameraBody(),
            photo.getCameraLens(),
            photo.getFValue(),
            photo.getShutterSpeed(),
            photo.getIso()
        );
    }

    /**
     * Issue#14: ユーザー情報オブジェクトを生成する
     */
    private PhotoDetailResponse.UserInfo createUserInfo(User user) {
        PhotoDetailResponse.SnsLinks snsLinks = new PhotoDetailResponse.SnsLinks(
            user.getTwitterUrl(),
            user.getInstagramUrl()
        );
        return new PhotoDetailResponse.UserInfo(
            user.getId(),
            user.getUsername(),
            user.getProfileImageUrl(),
            snsLinks
        );
    }
}
