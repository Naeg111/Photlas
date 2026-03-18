package com.photlas.backend.service;

import com.photlas.backend.entity.*;
import com.photlas.backend.repository.LocationSuggestionRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Issue#65: LocationSuggestionServiceのユニットテスト
 */
@ExtendWith(MockitoExtension.class)
public class LocationSuggestionServiceTest {

    private static final String SUGGESTER_EMAIL = "suggester@example.com";
    private static final String OWNER_EMAIL = "owner@example.com";
    private static final Long PHOTO_ID = 1L;
    private static final Long SUGGESTER_ID = 10L;
    private static final Long OWNER_ID = 20L;
    private static final Long SPOT_ID = 100L;
    private static final BigDecimal SUGGESTED_LAT = new BigDecimal("35.681236");
    private static final BigDecimal SUGGESTED_LNG = new BigDecimal("139.767125");
    private static final BigDecimal ORIGINAL_LAT = new BigDecimal("35.658581");
    private static final BigDecimal ORIGINAL_LNG = new BigDecimal("139.745433");
    private static final String REVIEW_TOKEN = "test-review-token";

    @Mock
    private LocationSuggestionRepository locationSuggestionRepository;

    @Mock
    private PhotoRepository photoRepository;

    @Mock
    private SpotRepository spotRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private JavaMailSender mailSender;

    @InjectMocks
    private LocationSuggestionService service;

    // ========================================
    // 指摘作成
    // ========================================

    @Test
    @DisplayName("Issue#65 - 指摘作成: 正常にPENDINGで保存されメールが送信される")
    void testCreateSuggestion_Success_SavesAndSendsEmail() {
        // Arrange
        User suggester = createMockUser(SUGGESTER_ID, SUGGESTER_EMAIL, "指摘ユーザー");
        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);

        when(userRepository.findByEmail(SUGGESTER_EMAIL)).thenReturn(Optional.of(suggester));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));
        when(userRepository.findById(OWNER_ID)).thenReturn(Optional.of(owner));
        when(locationSuggestionRepository.existsByPhotoIdAndSuggesterId(PHOTO_ID, SUGGESTER_ID)).thenReturn(false);
        when(locationSuggestionRepository.existsByPhotoIdAndStatusAndEmailSent(
                PHOTO_ID, LocationSuggestionStatus.PENDING, true)).thenReturn(false);
        when(locationSuggestionRepository.save(any(LocationSuggestion.class))).thenAnswer(i -> i.getArgument(0));

        // Act
        LocationSuggestion result = service.createSuggestion(PHOTO_ID, SUGGESTER_EMAIL, SUGGESTED_LAT, SUGGESTED_LNG);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getStatus()).isEqualTo(LocationSuggestionStatus.PENDING);
        assertThat(result.isEmailSent()).isTrue();
        assertThat(result.getReviewToken()).isNotNull();

        verify(mailSender, times(1)).send(any(SimpleMailMessage.class));
    }

    @Test
    @DisplayName("Issue#65 - 指摘作成: 同じ写真に対して既に指摘済みの場合はエラー")
    void testCreateSuggestion_AlreadySuggested_ThrowsException() {
        // Arrange
        User suggester = createMockUser(SUGGESTER_ID, SUGGESTER_EMAIL, "指摘ユーザー");
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);

        when(userRepository.findByEmail(SUGGESTER_EMAIL)).thenReturn(Optional.of(suggester));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));
        when(locationSuggestionRepository.existsByPhotoIdAndSuggesterId(PHOTO_ID, SUGGESTER_ID)).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> service.createSuggestion(PHOTO_ID, SUGGESTER_EMAIL, SUGGESTED_LAT, SUGGESTED_LNG))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("Issue#65 - 指摘作成: 自分の写真に対する指摘はエラー")
    void testCreateSuggestion_OwnPhoto_ThrowsException() {
        // Arrange
        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);

        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));

        // Act & Assert
        assertThatThrownBy(() -> service.createSuggestion(PHOTO_ID, OWNER_EMAIL, SUGGESTED_LAT, SUGGESTED_LNG))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("Issue#65 - 指摘作成: 未解決のメール通知済み指摘がある場合、メールは送信されない")
    void testCreateSuggestion_PendingExists_EmailNotSent() {
        // Arrange
        User suggester = createMockUser(SUGGESTER_ID, SUGGESTER_EMAIL, "指摘ユーザー");
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);

        when(userRepository.findByEmail(SUGGESTER_EMAIL)).thenReturn(Optional.of(suggester));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));
        when(locationSuggestionRepository.existsByPhotoIdAndSuggesterId(PHOTO_ID, SUGGESTER_ID)).thenReturn(false);
        when(locationSuggestionRepository.existsByPhotoIdAndStatusAndEmailSent(
                PHOTO_ID, LocationSuggestionStatus.PENDING, true)).thenReturn(true);
        when(locationSuggestionRepository.save(any(LocationSuggestion.class))).thenAnswer(i -> i.getArgument(0));

        // Act
        LocationSuggestion result = service.createSuggestion(PHOTO_ID, SUGGESTER_EMAIL, SUGGESTED_LAT, SUGGESTED_LNG);

        // Assert
        assertThat(result.isEmailSent()).isFalse();
        assertThat(result.getReviewToken()).isNull();
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    // ========================================
    // 指摘の受け入れ
    // ========================================

    @Test
    @DisplayName("Issue#65 - 受け入れ: ステータスがACCEPTEDに変更され、Spotが更新される")
    void testAcceptSuggestion_Success_UpdatesSpotAndStatus() {
        // Arrange
        LocationSuggestion suggestion = createMockSuggestion();
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);
        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");
        Spot newSpot = createMockSpot(200L, SUGGESTED_LAT, SUGGESTED_LNG);

        when(locationSuggestionRepository.findByReviewToken(REVIEW_TOKEN)).thenReturn(Optional.of(suggestion));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));
        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        when(spotRepository.findSpotsWithin200m(SUGGESTED_LAT, SUGGESTED_LNG)).thenReturn(List.of(newSpot));
        when(locationSuggestionRepository.findByPhotoIdAndStatusAndEmailSentOrderByCreatedAtAsc(
                PHOTO_ID, LocationSuggestionStatus.PENDING, false)).thenReturn(List.of());

        // Act
        service.acceptSuggestion(REVIEW_TOKEN, OWNER_EMAIL);

        // Assert
        assertThat(suggestion.getStatus()).isEqualTo(LocationSuggestionStatus.ACCEPTED);
        assertThat(suggestion.getResolvedAt()).isNotNull();
        assertThat(photo.getSpotId()).isEqualTo(200L);
        verify(photoRepository).save(photo);
    }

    @Test
    @DisplayName("Issue#65 - 受け入れ: 解決後に次の未通知指摘があればメールを送信する")
    void testAcceptSuggestion_NextPending_SendsEmail() {
        // Arrange
        LocationSuggestion suggestion = createMockSuggestion();
        LocationSuggestion nextSuggestion = new LocationSuggestion();
        nextSuggestion.setPhotoId(PHOTO_ID);
        nextSuggestion.setEmailSent(false);

        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);
        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");
        Spot newSpot = createMockSpot(200L, SUGGESTED_LAT, SUGGESTED_LNG);

        when(locationSuggestionRepository.findByReviewToken(REVIEW_TOKEN)).thenReturn(Optional.of(suggestion));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));
        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        when(userRepository.findById(OWNER_ID)).thenReturn(Optional.of(owner));
        when(spotRepository.findSpotsWithin200m(SUGGESTED_LAT, SUGGESTED_LNG)).thenReturn(List.of(newSpot));
        when(locationSuggestionRepository.findByPhotoIdAndStatusAndEmailSentOrderByCreatedAtAsc(
                PHOTO_ID, LocationSuggestionStatus.PENDING, false)).thenReturn(List.of(nextSuggestion));

        // Act
        service.acceptSuggestion(REVIEW_TOKEN, OWNER_EMAIL);

        // Assert
        assertThat(nextSuggestion.isEmailSent()).isTrue();
        assertThat(nextSuggestion.getReviewToken()).isNotNull();
        verify(mailSender, times(1)).send(any(SimpleMailMessage.class));
    }

    // ========================================
    // 指摘の拒否
    // ========================================

    @Test
    @DisplayName("Issue#65 - 拒否: ステータスがREJECTEDに変更され、指摘者にメールが送信される")
    void testRejectSuggestion_Success_SendsRejectionEmail() {
        // Arrange
        LocationSuggestion suggestion = createMockSuggestion();
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);
        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");
        User suggester = createMockUser(SUGGESTER_ID, SUGGESTER_EMAIL, "指摘ユーザー");

        when(locationSuggestionRepository.findByReviewToken(REVIEW_TOKEN)).thenReturn(Optional.of(suggestion));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));
        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        when(userRepository.findById(SUGGESTER_ID)).thenReturn(Optional.of(suggester));
        when(locationSuggestionRepository.findByPhotoIdAndStatusAndEmailSentOrderByCreatedAtAsc(
                PHOTO_ID, LocationSuggestionStatus.PENDING, false)).thenReturn(List.of());

        // Act
        service.rejectSuggestion(REVIEW_TOKEN, OWNER_EMAIL);

        // Assert
        assertThat(suggestion.getStatus()).isEqualTo(LocationSuggestionStatus.REJECTED);
        assertThat(suggestion.getResolvedAt()).isNotNull();

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(mailSender, times(1)).send(captor.capture());
        SimpleMailMessage sentMail = captor.getValue();
        assertThat(sentMail.getTo()).containsExactly(SUGGESTER_EMAIL);
    }

    // ========================================
    // 解決済み指摘への再操作防止
    // ========================================

    @Test
    @DisplayName("Issue#65 - 受け入れ: ACCEPTED済みの指摘を再度受け入れるとエラー")
    void testAcceptSuggestion_AlreadyAccepted_ThrowsException() {
        // Arrange: ステータスがACCEPTEDの指摘
        LocationSuggestion suggestion = createMockSuggestion();
        suggestion.setStatus(LocationSuggestionStatus.ACCEPTED);

        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);

        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        when(locationSuggestionRepository.findByReviewToken(REVIEW_TOKEN)).thenReturn(Optional.of(suggestion));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));

        // Act & Assert
        assertThatThrownBy(() -> service.acceptSuggestion(REVIEW_TOKEN, OWNER_EMAIL))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("解決済み");
    }

    @Test
    @DisplayName("Issue#65 - 拒否: REJECTED済みの指摘を再度拒否するとエラー")
    void testRejectSuggestion_AlreadyRejected_ThrowsException() {
        // Arrange: ステータスがREJECTEDの指摘
        LocationSuggestion suggestion = createMockSuggestion();
        suggestion.setStatus(LocationSuggestionStatus.REJECTED);

        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);

        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        when(locationSuggestionRepository.findByReviewToken(REVIEW_TOKEN)).thenReturn(Optional.of(suggestion));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));

        // Act & Assert
        assertThatThrownBy(() -> service.rejectSuggestion(REVIEW_TOKEN, OWNER_EMAIL))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("解決済み");
    }

    // ========================================
    // ヘルパーメソッド
    // ========================================

    private User createMockUser(Long id, String email, String username) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setUsername(username);
        return user;
    }

    private Photo createMockPhoto(Long photoId, Long userId, Long spotId) {
        Photo photo = new Photo();
        photo.setPhotoId(photoId);
        photo.setUserId(userId);
        photo.setSpotId(spotId);
        return photo;
    }

    private Spot createMockSpot(Long spotId, BigDecimal lat, BigDecimal lng) {
        Spot spot = new Spot();
        spot.setSpotId(spotId);
        spot.setLatitude(lat);
        spot.setLongitude(lng);
        return spot;
    }

    private LocationSuggestion createMockSuggestion() {
        LocationSuggestion suggestion = new LocationSuggestion();
        suggestion.setId(1L);
        suggestion.setPhotoId(PHOTO_ID);
        suggestion.setSuggesterId(SUGGESTER_ID);
        suggestion.setSuggestedLatitude(SUGGESTED_LAT);
        suggestion.setSuggestedLongitude(SUGGESTED_LNG);
        suggestion.setStatus(LocationSuggestionStatus.PENDING);
        suggestion.setReviewToken(REVIEW_TOKEN);
        suggestion.setEmailSent(true);
        return suggestion;
    }
}
