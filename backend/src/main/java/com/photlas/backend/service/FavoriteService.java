package com.photlas.backend.service;

import com.photlas.backend.dto.PhotoResponse;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.Favorite;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.FavoriteNotFoundException;
import com.photlas.backend.exception.PhotoNotFoundException;

import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.FavoriteRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
    private final S3Service s3Service;

    public FavoriteService(
            FavoriteRepository favoriteRepository,
            PhotoRepository photoRepository,
            SpotRepository spotRepository,
            UserRepository userRepository,
            S3Service s3Service
    ) {
        this.favoriteRepository = favoriteRepository;
        this.photoRepository = photoRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.s3Service = s3Service;
    }

    // エラーメッセージ定数
    private static final String ERROR_USER_NOT_FOUND = "ユーザーが見つかりません";
    private static final String ERROR_PHOTO_NOT_FOUND = "写真が見つかりません";
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
                .orElseThrow(() -> new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND));

        // Issue#54: 公開中の写真のみお気に入り登録可能
        if (!Integer.valueOf(CodeConstants.MODERATION_STATUS_PUBLISHED).equals(photo.getModerationStatus())) {
            throw new IllegalStateException("公開中の写真のみお気に入り登録できます");
        }

        // 通常フローでの重複チェック
        if (favoriteRepository.findByUserIdAndPhotoId(user.getId(), photoId).isPresent()) {
            logger.info("お気に入りは既に登録済みです: userId={}, photoId={}", user.getId(), photoId);
            throw new ConflictException(ERROR_ALREADY_FAVORITED);
        }

        Favorite favorite = new Favorite();
        favorite.setUserId(user.getId());
        favorite.setPhotoId(photoId);

        try {
            favoriteRepository.saveAndFlush(favorite);
        } catch (DataIntegrityViolationException e) {
            // 同時リクエストによるレースコンディション時のセーフティネット
            logger.info("お気に入りは既に登録済みです（並行リクエスト）: userId={}, photoId={}", user.getId(), photoId);
            throw new ConflictException(ERROR_ALREADY_FAVORITED);
        }

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
        Page<Favorite> favoritePage = favoriteRepository.findByUserIdExcludingDeletedUsers(user.getId(), pageable);

        // 写真詳細情報を取得
        List<PhotoResponse> photoResponseList = favoritePage.getContent().stream()
            .map(favorite -> {
                Photo photo = photoRepository.findById(favorite.getPhotoId()).orElse(null);
                if (photo == null) return null;
                User photoUser = userRepository.findById(photo.getUserId()).orElse(null);
                if (photoUser == null) return null;
                Spot spot = spotRepository.findById(photo.getSpotId()).orElse(null);
                if (spot == null) return null;
                long favoriteCount = favoriteRepository.countByPhotoId(photo.getPhotoId());
                return buildPhotoResponse(photo, spot, photoUser, true, favoriteCount);
            })
            .filter(r -> r != null)
            .collect(Collectors.toList());

        // ページネーション情報を含むレスポンスを構築
        Map<String, Object> response = new HashMap<>();
        response.put("content", photoResponseList);

        Map<String, Object> pageableInfo = new HashMap<>();
        pageableInfo.put("page_number", favoritePage.getNumber());
        pageableInfo.put("page_size", favoritePage.getSize());
        response.put("pageable", pageableInfo);

        response.put("total_pages", favoritePage.getTotalPages());
        response.put("total_elements", favoritePage.getTotalElements());
        response.put("last", favoritePage.isLast());

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
    private PhotoResponse buildPhotoResponse(Photo photo, Spot spot, User user, boolean isFavorited, long favoriteCount) {
        boolean isBlocked = CodeConstants.isBlockedContent(photo.getModerationStatus());
        String imageUrl = isBlocked
                ? s3Service.generateCdnUrl(CodeConstants.BLOCKED_CONTENT_IMAGE_KEY)
                : s3Service.generateCdnUrl(photo.getS3ObjectKey());

        PhotoResponse.PhotoDTO photoDTO = new PhotoResponse.PhotoDTO(
                photo.getPhotoId(),
                imageUrl,
                photo.getShotAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME),
                photo.getWeather(),
                isFavorited,
                favoriteCount
        );

        photoDTO.setThumbnailUrl(isBlocked
                ? s3Service.generateCdnUrl(CodeConstants.BLOCKED_CONTENT_IMAGE_KEY)
                : s3Service.generateThumbnailCdnUrl(photo.getS3ObjectKey()));
        photoDTO.setCropCenterX(photo.getCropCenterX());
        photoDTO.setCropCenterY(photo.getCropCenterY());
        photoDTO.setCropZoom(photo.getCropZoom());

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
}
