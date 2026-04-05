package com.photlas.backend.service;

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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Issue#30: FavoriteServiceのユニットテスト
 */
@ExtendWith(MockitoExtension.class)
public class FavoriteServiceTest {

    @Mock
    private FavoriteRepository favoriteRepository;

    @Mock
    private PhotoRepository photoRepository;

    @Mock
    private SpotRepository spotRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private S3Service s3Service;

    @InjectMocks
    private FavoriteService favoriteService;

    private static final String TEST_EMAIL = "test@example.com";
    private static final Long TEST_USER_ID = 1L;
    private static final Long TEST_PHOTO_ID = 10L;

    /**
     * テスト用Userエンティティを作成する
     */
    private User createTestUser() {
        User user = new User("テストユーザー", TEST_EMAIL, "hashedPassword", CodeConstants.ROLE_USER);
        user.setId(TEST_USER_ID);
        return user;
    }

    /**
     * テスト用Photoエンティティを作成する
     */
    private Photo createTestPhoto() {
        Photo photo = new Photo();
        photo.setPhotoId(TEST_PHOTO_ID);
        photo.setUserId(TEST_USER_ID);
        photo.setSpotId(100L);
        photo.setS3ObjectKey("photos/test.jpg");
        photo.setShotAt(LocalDateTime.of(2026, 1, 1, 12, 0));
        photo.setWeather(CodeConstants.WEATHER_SUNNY);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        return photo;
    }

    @Test
    @DisplayName("Issue#30 - addFavorite: DataIntegrityViolationExceptionがConflictExceptionに変換される")
    void addFavorite_DataIntegrityViolation_ThrowsConflictException() {
        // Given
        User user = createTestUser();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(photoRepository.findById(TEST_PHOTO_ID)).thenReturn(Optional.of(createTestPhoto()));
        when(favoriteRepository.findByUserIdAndPhotoId(TEST_USER_ID, TEST_PHOTO_ID))
                .thenReturn(Optional.empty());
        when(favoriteRepository.saveAndFlush(any(Favorite.class)))
                .thenThrow(new DataIntegrityViolationException("Duplicate entry"));

        // When & Then
        assertThatThrownBy(() -> favoriteService.addFavorite(TEST_PHOTO_ID, TEST_EMAIL))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("既にお気に入り登録されています");
    }

    @Test
    @DisplayName("Issue#30 - addFavorite: ユーザーが見つからない場合UserNotFoundExceptionがスローされる")
    void addFavorite_UserNotFound_ThrowsUserNotFoundException() {
        // Given
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.empty());

        // When & Then
        assertThatThrownBy(() -> favoriteService.addFavorite(TEST_PHOTO_ID, TEST_EMAIL))
                .isInstanceOf(UserNotFoundException.class)
                .hasMessageContaining("ユーザーが見つかりません");
    }

    @Test
    @DisplayName("Issue#30 - addFavorite: 写真が見つからない場合PhotoNotFoundExceptionがスローされる")
    void addFavorite_PhotoNotFound_ThrowsPhotoNotFoundException() {
        // Given
        User user = createTestUser();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(photoRepository.findById(TEST_PHOTO_ID)).thenReturn(Optional.empty());

        // When & Then
        assertThatThrownBy(() -> favoriteService.addFavorite(TEST_PHOTO_ID, TEST_EMAIL))
                .isInstanceOf(PhotoNotFoundException.class)
                .hasMessageContaining("写真が見つかりません");
    }

    @Test
    @DisplayName("Issue#30 - removeFavorite: お気に入り未登録の場合FavoriteNotFoundExceptionがスローされる")
    void removeFavorite_NotFavorited_ThrowsFavoriteNotFoundException() {
        // Given
        User user = createTestUser();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(favoriteRepository.findByUserIdAndPhotoId(TEST_USER_ID, TEST_PHOTO_ID))
                .thenReturn(Optional.empty());

        // When & Then
        assertThatThrownBy(() -> favoriteService.removeFavorite(TEST_PHOTO_ID, TEST_EMAIL))
                .isInstanceOf(FavoriteNotFoundException.class)
                .hasMessageContaining("お気に入り登録されていません");
    }

    @Test
    @DisplayName("Issue#30 - getFavoriteCount: リポジトリのcountByPhotoIdに委譲される")
    void getFavoriteCount_DelegatesToRepository() {
        // Given
        when(favoriteRepository.countByPhotoId(TEST_PHOTO_ID)).thenReturn(5L);

        // When
        long count = favoriteService.getFavoriteCount(TEST_PHOTO_ID);

        // Then
        assertThat(count).isEqualTo(5L);
        verify(favoriteRepository, times(1)).countByPhotoId(TEST_PHOTO_ID);
    }

    @Test
    @DisplayName("Issue#30 - isFavorited: userIdがnullの場合falseを返す")
    void isFavorited_NullUserId_ReturnsFalse() {
        // When
        boolean result = favoriteService.isFavorited(TEST_PHOTO_ID, null);

        // Then
        assertThat(result).isFalse();
        verifyNoInteractions(favoriteRepository);
    }

    @Test
    @DisplayName("Issue#30 - isFavorited: お気に入り登録済みの場合trueを返す")
    void isFavorited_FavoriteExists_ReturnsTrue() {
        // Given
        Favorite favorite = new Favorite();
        favorite.setUserId(TEST_USER_ID);
        favorite.setPhotoId(TEST_PHOTO_ID);
        when(favoriteRepository.findByUserIdAndPhotoId(TEST_USER_ID, TEST_PHOTO_ID))
                .thenReturn(Optional.of(favorite));

        // When
        boolean result = favoriteService.isFavorited(TEST_PHOTO_ID, TEST_USER_ID);

        // Then
        assertThat(result).isTrue();
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("Issue#30 - getFavorites: 正しいページネーション構造を返す")
    void getFavorites_ReturnsCorrectPaginationStructure() {
        // Given
        User user = createTestUser();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        Favorite favorite = new Favorite();
        favorite.setUserId(TEST_USER_ID);
        favorite.setPhotoId(TEST_PHOTO_ID);

        Page<Favorite> favoritePage = new PageImpl<>(
                List.of(favorite),
                PageRequest.of(0, 10),
                1
        );
        when(favoriteRepository.findByUserIdExcludingDeletedUsers(eq(TEST_USER_ID), any())).thenReturn(favoritePage);

        Photo photo = createTestPhoto();
        when(photoRepository.findById(TEST_PHOTO_ID)).thenReturn(Optional.of(photo));

        Spot spot = new Spot();
        spot.setSpotId(100L);
        spot.setLatitude(new BigDecimal("35.681236"));
        spot.setLongitude(new BigDecimal("139.767125"));
        when(spotRepository.findById(100L)).thenReturn(Optional.of(spot));
        when(userRepository.findById(TEST_USER_ID)).thenReturn(Optional.of(user));
        when(favoriteRepository.countByPhotoId(TEST_PHOTO_ID)).thenReturn(1L);
        when(s3Service.generateCdnUrl("photos/test.jpg")).thenReturn("https://cdn.example.com/photos/test.jpg");

        // When
        Map<String, Object> result = favoriteService.getFavorites(TEST_EMAIL, 0, 10);

        // Then
        assertThat(result).containsKey("content");
        assertThat(result).containsKey("pageable");
        assertThat(result).containsKey("total_pages");
        assertThat(result).containsKey("total_elements");
        assertThat(result).containsKey("last");
        assertThat(result.get("total_elements")).isEqualTo(1L);
        assertThat(result.get("last")).isEqualTo(true);

        Map<String, Object> pageableInfo = (Map<String, Object>) result.get("pageable");
        assertThat(pageableInfo.get("page_number")).isEqualTo(0);
        assertThat(pageableInfo.get("page_size")).isEqualTo(10);
    }

    @Test
    @DisplayName("Issue#54 - addFavorite: QUARANTINED写真はお気に入り登録できない")
    void addFavorite_QuarantinedPhoto_ThrowsException() {
        // Given
        User user = createTestUser();
        Photo photo = createTestPhoto();
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_QUARANTINED);

        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(photoRepository.findById(TEST_PHOTO_ID)).thenReturn(Optional.of(photo));

        // When & Then
        assertThatThrownBy(() -> favoriteService.addFavorite(TEST_PHOTO_ID, TEST_EMAIL))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("公開中の写真のみ");
    }

    @Test
    @DisplayName("Issue#54 - addFavorite: PENDING_REVIEW写真はお気に入り登録できない")
    void addFavorite_PendingReviewPhoto_ThrowsException() {
        // Given
        User user = createTestUser();
        Photo photo = createTestPhoto();
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PENDING_REVIEW);

        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(photoRepository.findById(TEST_PHOTO_ID)).thenReturn(Optional.of(photo));

        // When & Then
        assertThatThrownBy(() -> favoriteService.addFavorite(TEST_PHOTO_ID, TEST_EMAIL))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("公開中の写真のみ");
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("Issue#72 - getFavorites: 退会済みユーザーの写真がお気に入り一覧から除外される")
    void getFavorites_ExcludesDeletedUserPhotos() {
        // Given: 退会済みユーザーの写真はDB側で除外されるため、リポジトリが空ページを返す
        User user = createTestUser();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        Page<Favorite> emptyPage = new PageImpl<>(
                List.of(),
                PageRequest.of(0, 10),
                0
        );
        when(favoriteRepository.findByUserIdExcludingDeletedUsers(eq(TEST_USER_ID), any())).thenReturn(emptyPage);

        // When
        Map<String, Object> result = favoriteService.getFavorites(TEST_EMAIL, 0, 10);

        // Then: 退会済みユーザーの写真は結果に含まれない
        List<?> content = (List<?>) result.get("content");
        assertThat(content).isEmpty();
        assertThat(result.get("total_elements")).isEqualTo(0L);
    }

    @SuppressWarnings("unchecked")
    @Test
    @DisplayName("レポート#27-1 - getFavorites: 退会済みユーザーの写真がある場合もtotal_elementsとtotal_pagesが整合する")
    void getFavorites_WithDeletedUserPhotos_TotalElementsAndTotalPagesAreConsistent() {
        // Given: 全3件のお気に入りのうち退会済みユーザーの写真1件はDB側で除外済み
        // リポジトリは有効な2件のみ返す（ページサイズ2 → 1ページ）
        User user = createTestUser();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        User activeUser = new User("アクティブ", "active@example.com", "hash", CodeConstants.ROLE_USER);
        activeUser.setId(2L);

        Photo photo1 = createTestPhoto();
        photo1.setPhotoId(10L);
        photo1.setUserId(2L);

        Photo photo2 = createTestPhoto();
        photo2.setPhotoId(11L);
        photo2.setUserId(2L);
        photo2.setS3ObjectKey("photos/test2.jpg");

        Favorite fav1 = new Favorite();
        fav1.setUserId(TEST_USER_ID);
        fav1.setPhotoId(10L);

        Favorite fav2 = new Favorite();
        fav2.setUserId(TEST_USER_ID);
        fav2.setPhotoId(11L);

        // DB側で退会済みユーザーの写真を除外済みの結果（2件、ページサイズ2 → 1ページ）
        Page<Favorite> favoritePage = new PageImpl<>(
                List.of(fav1, fav2),
                PageRequest.of(0, 2),
                2
        );
        when(favoriteRepository.findByUserIdExcludingDeletedUsers(eq(TEST_USER_ID), any())).thenReturn(favoritePage);

        when(photoRepository.findById(10L)).thenReturn(Optional.of(photo1));
        when(photoRepository.findById(11L)).thenReturn(Optional.of(photo2));
        when(userRepository.findById(2L)).thenReturn(Optional.of(activeUser));

        Spot spot = new Spot();
        spot.setSpotId(100L);
        spot.setLatitude(new BigDecimal("35.681236"));
        spot.setLongitude(new BigDecimal("139.767125"));
        when(spotRepository.findById(100L)).thenReturn(Optional.of(spot));
        when(favoriteRepository.countByPhotoId(any())).thenReturn(1L);
        when(s3Service.generateCdnUrl(any())).thenReturn("https://cdn.example.com/photo.jpg");

        // When
        Map<String, Object> result = favoriteService.getFavorites(TEST_EMAIL, 0, 2);

        // Then: total_elementsとtotal_pagesが整合する
        List<?> content = (List<?>) result.get("content");
        assertThat(content).hasSize(2);
        assertThat(result.get("total_elements")).isEqualTo(2L);
        assertThat(result.get("total_pages")).isEqualTo(1);

        long totalElements = (long) result.get("total_elements");
        int totalPages = (int) result.get("total_pages");
        int pageSize = 2;
        int expectedTotalPages = (int) Math.ceil((double) totalElements / pageSize);
        assertThat(totalPages)
                .as("total_pages(%d)はtotal_elements(%d)/pageSize(%d)と整合すべき", totalPages, totalElements, pageSize)
                .isEqualTo(expectedTotalPages);
    }
}
