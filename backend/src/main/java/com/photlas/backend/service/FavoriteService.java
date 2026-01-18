package com.photlas.backend.service;

import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.entity.Favorite;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.FavoriteNotFoundException;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.FavoriteRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

/**
 * お気に入りサービス
 * お気に入りの追加・削除・一覧取得などのビジネスロジックを提供します。
 */
@Service
public class FavoriteService {

    private static final Logger logger = LoggerFactory.getLogger(FavoriteService.class);

    private final FavoriteRepository favoriteRepository;
    private final PhotoRepository photoRepository;
    private final SpotRepository spotRepository;
    private final UserRepository userRepository;

    public FavoriteService(
            FavoriteRepository favoriteRepository,
            PhotoRepository photoRepository,
            SpotRepository spotRepository,
            UserRepository userRepository
    ) {
        this.favoriteRepository = favoriteRepository;
        this.photoRepository = photoRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
    }

    // エラーメッセージ定数
    private static final String ERROR_USER_NOT_FOUND = "ユーザーが見つかりません";
    private static final String ERROR_PHOTO_NOT_FOUND = "写真が見つかりません";
    private static final String ERROR_SPOT_NOT_FOUND = "スポットが見つかりません";
    private static final String ERROR_ALREADY_FAVORITED = "既にお気に入り登録されています";
    private static final String ERROR_NOT_FAVORITED = "お気に入り登録されていません";

    /**
     * お気に入りに登録する（Issue#30）
     * @throws ConflictException 既に登録済みの場合
     */
    @Transactional
    public void addFavorite(Long photoId, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new RuntimeException(ERROR_PHOTO_NOT_FOUND));

        // すでに登録済みかチェック
        if (favoriteRepository.findByUserIdAndPhotoId(user.getId(), photoId).isPresent()) {
            logger.info("お気に入りは既に登録済みです: userId={}, photoId={}", user.getId(), photoId);
            throw new ConflictException(ERROR_ALREADY_FAVORITED);
        }

        Favorite favorite = new Favorite();
        favorite.setUserId(user.getId());
        favorite.setPhotoId(photoId);
        favoriteRepository.save(favorite);

        logger.info("お気に入りに登録しました: userId={}, photoId={}", user.getId(), photoId);
    }

    /**
     * お気に入りを解除する（Issue#30）
     * @throws FavoriteNotFoundException お気に入り登録されていない場合
     */
    @Transactional
    public void removeFavorite(Long photoId, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

        Favorite favorite = favoriteRepository.findByUserIdAndPhotoId(user.getId(), photoId)
                .orElseThrow(() -> {
                    logger.info("お気に入りは登録されていません: userId={}, photoId={}", user.getId(), photoId);
                    return new FavoriteNotFoundException(ERROR_NOT_FAVORITED);
                });

        favoriteRepository.delete(favorite);
        logger.info("お気に入りを解除しました: userId={}, photoId={}", user.getId(), photoId);
    }

    /**
     * 写真のお気に入り数を取得する（Issue#30）
     */
    @Transactional(readOnly = true)
    public long getFavoriteCount(Long photoId) {
        return favoriteRepository.countByPhotoId(photoId);
    }

    /**
     * お気に入り一覧を取得する（ページネーション対応）
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getFavorites(String email, int page, int size) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

        Pageable pageable = PageRequest.of(page, size);
        Page<Favorite> favoritePage = favoriteRepository.findByUserId(user.getId(), pageable);

        // 写真詳細情報を取得
        Page<PhotoResponse> photoResponses = favoritePage.map(favorite -> {
            Photo photo = photoRepository.findById(favorite.getPhotoId())
                    .orElseThrow(() -> new RuntimeException(ERROR_PHOTO_NOT_FOUND));
            Spot spot = spotRepository.findById(photo.getSpotId())
                    .orElseThrow(() -> new RuntimeException(ERROR_SPOT_NOT_FOUND));
            User photoUser = userRepository.findById(photo.getUserId())
                    .orElseThrow(() -> new RuntimeException(ERROR_USER_NOT_FOUND));

            return buildPhotoResponse(photo, spot, photoUser, true);
        });

        // ページネーション情報を含むレスポンスを構築
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
     * お気に入り状態をチェックする
     */
    @Transactional(readOnly = true)
    public boolean isFavorited(Long photoId, Long userId) {
        if (userId == null) {
            return false;
        }
        return favoriteRepository.findByUserIdAndPhotoId(userId, photoId).isPresent();
    }

    /**
     * PhotoResponseを構築する
     */
    private PhotoResponse buildPhotoResponse(Photo photo, Spot spot, User user, boolean isFavorited) {
        PhotoResponse.PhotoDTO photoDTO = new PhotoResponse.PhotoDTO(
                photo.getPhotoId(),
                photo.getTitle(),
                photo.getS3ObjectKey(),
                photo.getShotAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                photo.getWeather(),
                isFavorited
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
