package com.photlas.backend.service;

import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.entity.Favorite;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
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

    /**
     * お気に入りに登録する（冪等性）
     */
    @Transactional
    public void addFavorite(Long photoId, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new RuntimeException("写真が見つかりません"));

        // すでに登録済みかチェック（冪等性）
        if (favoriteRepository.findByUserIdAndPhotoId(user.getId(), photoId).isPresent()) {
            logger.info("お気に入りは既に登録済みです: userId={}, photoId={}", user.getId(), photoId);
            return;
        }

        Favorite favorite = new Favorite();
        favorite.setUserId(user.getId());
        favorite.setPhotoId(photoId);
        favoriteRepository.save(favorite);

        logger.info("お気に入りに登録しました: userId={}, photoId={}", user.getId(), photoId);
    }

    /**
     * お気に入りを解除する（冪等性）
     */
    @Transactional
    public void removeFavorite(Long photoId, String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

        favoriteRepository.findByUserIdAndPhotoId(user.getId(), photoId)
                .ifPresentOrElse(
                        favorite -> {
                            favoriteRepository.delete(favorite);
                            logger.info("お気に入りを解除しました: userId={}, photoId={}", user.getId(), photoId);
                        },
                        () -> logger.info("お気に入りは登録されていません（冪等性）: userId={}, photoId={}", user.getId(), photoId)
                );
    }

    /**
     * お気に入り一覧を取得する（ページネーション対応）
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getFavorites(String email, int page, int size) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

        Pageable pageable = PageRequest.of(page, size);
        Page<Favorite> favoritePage = favoriteRepository.findByUserId(user.getId(), pageable);

        // 写真詳細情報を取得
        Page<PhotoResponse> photoResponses = favoritePage.map(favorite -> {
            Photo photo = photoRepository.findById(favorite.getPhotoId())
                    .orElseThrow(() -> new RuntimeException("写真が見つかりません"));
            Spot spot = spotRepository.findById(photo.getSpotId())
                    .orElseThrow(() -> new RuntimeException("スポットが見つかりません"));
            User photoUser = userRepository.findById(photo.getUserId())
                    .orElseThrow(() -> new RuntimeException("ユーザーが見つかりません"));

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
