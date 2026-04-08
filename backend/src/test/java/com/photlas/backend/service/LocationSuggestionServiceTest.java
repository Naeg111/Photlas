package com.photlas.backend.service;

import com.photlas.backend.dto.LocationSuggestionReviewResponse;
import com.photlas.backend.entity.CodeConstants;
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
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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

    @Mock
    private S3Service s3Service;

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
                PHOTO_ID, CodeConstants.SUGGESTION_STATUS_PENDING, true)).thenReturn(false);
        when(locationSuggestionRepository.save(any(LocationSuggestion.class))).thenAnswer(i -> i.getArgument(0));

        // Act
        LocationSuggestion result = service.createSuggestion(PHOTO_ID, SUGGESTER_EMAIL, SUGGESTED_LAT, SUGGESTED_LNG);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getStatus()).isEqualTo(CodeConstants.SUGGESTION_STATUS_PENDING);
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
                PHOTO_ID, CodeConstants.SUGGESTION_STATUS_PENDING, true)).thenReturn(true);
        when(locationSuggestionRepository.save(any(LocationSuggestion.class))).thenAnswer(i -> i.getArgument(0));

        // Act
        LocationSuggestion result = service.createSuggestion(PHOTO_ID, SUGGESTER_EMAIL, SUGGESTED_LAT, SUGGESTED_LNG);

        // Assert
        assertThat(result.isEmailSent()).isFalse();
        assertThat(result.getReviewToken()).isNull();
        verify(mailSender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    @DisplayName("Issue#65 - 指摘作成: 1日の指摘件数が上限（10件）を超えるとエラー")
    void testCreateSuggestion_DailyLimitExceeded_ThrowsException() {
        // Arrange
        User suggester = createMockUser(SUGGESTER_ID, SUGGESTER_EMAIL, "指摘ユーザー");
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);

        when(userRepository.findByEmail(SUGGESTER_EMAIL)).thenReturn(Optional.of(suggester));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));
        // 今日既に10件の指摘を行っている
        when(locationSuggestionRepository.countBySuggesterIdAndCreatedAtAfter(
                eq(SUGGESTER_ID), any(LocalDateTime.class))).thenReturn(10L);

        // Act & Assert
        assertThatThrownBy(() -> service.createSuggestion(PHOTO_ID, SUGGESTER_EMAIL, SUGGESTED_LAT, SUGGESTED_LNG))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("上限");
    }

    @Test
    @DisplayName("Issue#65 - 指摘作成: 公開中でない写真に対する指摘はエラー（REMOVED）")
    void testCreateSuggestion_RemovedPhoto_ThrowsException() {
        // Arrange
        User suggester = createMockUser(SUGGESTER_ID, SUGGESTER_EMAIL, "指摘ユーザー");
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_REMOVED);

        when(userRepository.findByEmail(SUGGESTER_EMAIL)).thenReturn(Optional.of(suggester));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));

        // Act & Assert
        assertThatThrownBy(() -> service.createSuggestion(PHOTO_ID, SUGGESTER_EMAIL, SUGGESTED_LAT, SUGGESTED_LNG))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("公開中");
    }

    @Test
    @DisplayName("Issue#65 - 指摘作成: 公開中でない写真に対する指摘はエラー（QUARANTINED）")
    void testCreateSuggestion_QuarantinedPhoto_ThrowsException() {
        // Arrange
        User suggester = createMockUser(SUGGESTER_ID, SUGGESTER_EMAIL, "指摘ユーザー");
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_QUARANTINED);

        when(userRepository.findByEmail(SUGGESTER_EMAIL)).thenReturn(Optional.of(suggester));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));

        // Act & Assert
        assertThatThrownBy(() -> service.createSuggestion(PHOTO_ID, SUGGESTER_EMAIL, SUGGESTED_LAT, SUGGESTED_LNG))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("公開中");
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
                PHOTO_ID, CodeConstants.SUGGESTION_STATUS_PENDING, false)).thenReturn(List.of());

        // Act
        service.acceptSuggestion(REVIEW_TOKEN, OWNER_EMAIL);

        // Assert
        assertThat(suggestion.getStatus()).isEqualTo(CodeConstants.SUGGESTION_STATUS_ACCEPTED);
        assertThat(suggestion.getResolvedAt()).isNotNull();
        assertThat(photo.getSpotId()).isEqualTo(200L);
        // レポート#32 #2: 写真自体の座標も指摘された座標に更新されること
        assertThat(photo.getLatitude()).isEqualByComparingTo(SUGGESTED_LAT);
        assertThat(photo.getLongitude()).isEqualByComparingTo(SUGGESTED_LNG);
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
                PHOTO_ID, CodeConstants.SUGGESTION_STATUS_PENDING, false)).thenReturn(List.of(nextSuggestion));

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
                PHOTO_ID, CodeConstants.SUGGESTION_STATUS_PENDING, false)).thenReturn(List.of());

        // Act
        service.rejectSuggestion(REVIEW_TOKEN, OWNER_EMAIL);

        // Assert
        assertThat(suggestion.getStatus()).isEqualTo(CodeConstants.SUGGESTION_STATUS_REJECTED);
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
        suggestion.setStatus(CodeConstants.SUGGESTION_STATUS_ACCEPTED);

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
        suggestion.setStatus(CodeConstants.SUGGESTION_STATUS_REJECTED);

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
    // #3: メール送信失敗時のemailSentフラグ
    // ========================================

    @Test
    @DisplayName("Issue#54 - 指摘作成: メール送信失敗時はemailSentがfalseになる")
    void testCreateSuggestion_MailSendFails_EmailSentIsFalse() {
        // Arrange
        User suggester = createMockUser(SUGGESTER_ID, SUGGESTER_EMAIL, "指摘ユーザー");
        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);

        when(userRepository.findByEmail(SUGGESTER_EMAIL)).thenReturn(Optional.of(suggester));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));
        when(userRepository.findById(OWNER_ID)).thenReturn(Optional.of(owner));
        when(locationSuggestionRepository.existsByPhotoIdAndSuggesterId(PHOTO_ID, SUGGESTER_ID)).thenReturn(false);
        when(locationSuggestionRepository.existsByPhotoIdAndStatusAndEmailSent(
                PHOTO_ID, CodeConstants.SUGGESTION_STATUS_PENDING, true)).thenReturn(false);
        when(locationSuggestionRepository.save(any(LocationSuggestion.class))).thenAnswer(i -> i.getArgument(0));

        // メール送信を失敗させる
        doThrow(new RuntimeException("SMTP error")).when(mailSender).send(any(SimpleMailMessage.class));

        // Act
        LocationSuggestion result = service.createSuggestion(PHOTO_ID, SUGGESTER_EMAIL, SUGGESTED_LAT, SUGGESTED_LNG);

        // Assert: メール送信に失敗したのでemailSentはfalse
        assertThat(result.isEmailSent()).isFalse();
    }

    @Test
    @DisplayName("Issue#54 - sendNextPendingEmail: メール送信失敗時はemailSentがfalseのまま")
    void testAcceptSuggestion_NextPendingMailFails_EmailSentIsFalse() {
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
                PHOTO_ID, CodeConstants.SUGGESTION_STATUS_PENDING, false)).thenReturn(List.of(nextSuggestion));

        // 次の指摘のメール送信を失敗させる
        doThrow(new RuntimeException("SMTP error")).when(mailSender).send(any(SimpleMailMessage.class));

        // Act
        service.acceptSuggestion(REVIEW_TOKEN, OWNER_EMAIL);

        // Assert: メール送信に失敗したのでemailSentはfalse
        assertThat(nextSuggestion.isEmailSent()).isFalse();
    }

    // ========================================
    // #5: QUARANTINED/REMOVED写真への指摘操作ブロック
    // ========================================

    @Test
    @DisplayName("Issue#54 - 受け入れ: QUARANTINED写真への操作はブロックされる")
    void testAcceptSuggestion_QuarantinedPhoto_ThrowsException() {
        LocationSuggestion suggestion = createMockSuggestion();
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_QUARANTINED);
        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");

        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        when(locationSuggestionRepository.findByReviewToken(REVIEW_TOKEN)).thenReturn(Optional.of(suggestion));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));

        assertThatThrownBy(() -> service.acceptSuggestion(REVIEW_TOKEN, OWNER_EMAIL))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("審査中");
    }

    @Test
    @DisplayName("Issue#54 - 受け入れ: REMOVED写真への操作はブロックされる")
    void testAcceptSuggestion_RemovedPhoto_ThrowsException() {
        LocationSuggestion suggestion = createMockSuggestion();
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_REMOVED);
        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");

        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        when(locationSuggestionRepository.findByReviewToken(REVIEW_TOKEN)).thenReturn(Optional.of(suggestion));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));

        assertThatThrownBy(() -> service.acceptSuggestion(REVIEW_TOKEN, OWNER_EMAIL))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("削除された");
    }

    @Test
    @DisplayName("Issue#54 - 拒否: QUARANTINED写真への操作はブロックされる")
    void testRejectSuggestion_QuarantinedPhoto_ThrowsException() {
        LocationSuggestion suggestion = createMockSuggestion();
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_QUARANTINED);
        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");

        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        when(locationSuggestionRepository.findByReviewToken(REVIEW_TOKEN)).thenReturn(Optional.of(suggestion));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));

        assertThatThrownBy(() -> service.rejectSuggestion(REVIEW_TOKEN, OWNER_EMAIL))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("審査中");
    }

    @Test
    @DisplayName("Issue#54 - 拒否: REMOVED写真への操作はブロックされる")
    void testRejectSuggestion_RemovedPhoto_ThrowsException() {
        LocationSuggestion suggestion = createMockSuggestion();
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_REMOVED);
        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");

        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        when(locationSuggestionRepository.findByReviewToken(REVIEW_TOKEN)).thenReturn(Optional.of(suggestion));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));

        assertThatThrownBy(() -> service.rejectSuggestion(REVIEW_TOKEN, OWNER_EMAIL))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("削除された");
    }

    // ========================================
    // ReviewResponse DTO拡張
    // ========================================

    @Test
    @DisplayName("Issue#54 - getReviewResponse: 画像URL・ユーザー名・場所名・撮影日時が含まれる")
    void testGetReviewResponse_IncludesPhotoDetails() {
        LocationSuggestion suggestion = createMockSuggestion();
        Photo photo = createMockPhoto(PHOTO_ID, OWNER_ID, SPOT_ID);
        photo.setPlaceName("東京タワー");
        photo.setShotAt(LocalDateTime.of(2026, 3, 1, 12, 0));
        photo.setS3ObjectKey("uploads/1/test.jpg");
        User owner = createMockUser(OWNER_ID, OWNER_EMAIL, "投稿者");
        Spot spot = createMockSpot(SPOT_ID, ORIGINAL_LAT, ORIGINAL_LNG);

        when(userRepository.findByEmail(OWNER_EMAIL)).thenReturn(Optional.of(owner));
        when(userRepository.findById(OWNER_ID)).thenReturn(Optional.of(owner));
        when(locationSuggestionRepository.findByReviewToken(REVIEW_TOKEN)).thenReturn(Optional.of(suggestion));
        when(photoRepository.findById(PHOTO_ID)).thenReturn(Optional.of(photo));
        when(spotRepository.findById(SPOT_ID)).thenReturn(Optional.of(spot));
        when(s3Service.generateCdnUrl("uploads/1/test.jpg")).thenReturn("https://cdn/uploads/1/test.jpg");
        when(s3Service.generateThumbnailCdnUrl("uploads/1/test.jpg")).thenReturn("https://cdn/thumbnails/uploads/1/test.webp");

        LocationSuggestionReviewResponse response = service.getReviewResponse(REVIEW_TOKEN, OWNER_EMAIL);

        assertThat(response.getImageUrl()).isEqualTo("https://cdn/uploads/1/test.jpg");
        assertThat(response.getThumbnailUrl()).isEqualTo("https://cdn/thumbnails/uploads/1/test.webp");
        assertThat(response.getUsername()).isEqualTo("投稿者");
        assertThat(response.getPlaceName()).isEqualTo("東京タワー");
        assertThat(response.getShotAt()).isNotNull();
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
        photo.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
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
        suggestion.setStatus(CodeConstants.SUGGESTION_STATUS_PENDING);
        suggestion.setReviewToken(REVIEW_TOKEN);
        suggestion.setEmailSent(true);
        return suggestion;
    }
}
