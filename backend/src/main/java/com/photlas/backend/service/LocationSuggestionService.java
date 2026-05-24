package com.photlas.backend.service;

import com.photlas.backend.dto.LocationSuggestionReviewResponse;
import com.photlas.backend.entity.CodeConstants;
import java.time.format.DateTimeFormatter;
import com.photlas.backend.entity.LocationSuggestion;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.LocationSuggestionRepository;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/**
 * Issue#65: 位置情報修正の指摘サービス
 */
@Service
public class LocationSuggestionService {

    private static final Logger logger = LoggerFactory.getLogger(LocationSuggestionService.class);
    private static final String ERROR_USER_NOT_FOUND = "ユーザーが見つかりません";
    private static final String ERROR_PHOTO_NOT_FOUND = "写真が見つかりません";

    // Issue#146: 撮影場所指摘の距離制限（SpotRepository の haversine と同じ地球半径を使用）
    private static final double EARTH_RADIUS_METERS = 6371000.0;
    /** 指摘の下限距離（これ未満は近すぎる誤差レベルの指摘として拒否）。全写真共通。 */
    private static final double SUGGESTION_MIN_DISTANCE_METERS = 30.0;
    /** GPS 由来写真の指摘の上限距離（これ超は離れすぎとして拒否）。 */
    private static final double SUGGESTION_MAX_DISTANCE_METERS = 1000.0;

    private final LocationSuggestionRepository locationSuggestionRepository;
    private final PhotoRepository photoRepository;
    private final SpotRepository spotRepository;
    private final UserRepository userRepository;
    private final JavaMailSender mailSender;
    private final S3Service s3Service;
    private final EmailTemplateService emailTemplateService;

    @Value("${app.frontend-url:https://photlas.jp}")
    private String frontendUrl;

    @Value("${app.mail.from:Photlas <noreply@photlas.jp>}")
    private String mailFrom;

    public LocationSuggestionService(
            LocationSuggestionRepository locationSuggestionRepository,
            PhotoRepository photoRepository,
            SpotRepository spotRepository,
            UserRepository userRepository,
            JavaMailSender mailSender,
            S3Service s3Service,
            EmailTemplateService emailTemplateService) {
        this.locationSuggestionRepository = locationSuggestionRepository;
        this.photoRepository = photoRepository;
        this.spotRepository = spotRepository;
        this.userRepository = userRepository;
        this.mailSender = mailSender;
        this.s3Service = s3Service;
        this.emailTemplateService = emailTemplateService;
    }

    /**
     * 位置情報の指摘を作成する
     */
    @Transactional
    public LocationSuggestion createSuggestion(Long photoId, String suggesterEmail,
                                                BigDecimal latitude, BigDecimal longitude) {
        User suggester = userRepository.findByEmail(suggesterEmail)
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

        Photo photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND));

        // 1日あたりの指摘件数制限
        long dailyCount = locationSuggestionRepository.countBySuggesterIdAndCreatedAtAfter(
                suggester.getId(), LocalDateTime.now().toLocalDate().atStartOfDay());
        if (dailyCount >= 10) {
            throw new IllegalStateException("1日あたりの指摘件数の上限に達しました");
        }

        // 公開中の写真のみ指摘可能
        if (!Integer.valueOf(CodeConstants.MODERATION_STATUS_PUBLISHED).equals(photo.getModerationStatus())) {
            throw new IllegalStateException("公開中の写真のみ撮影場所の指摘ができます");
        }

        // 自分の写真には指摘できない
        if (photo.getUserId().equals(suggester.getId())) {
            throw new IllegalStateException("自分の投稿に対して撮影場所の指摘はできません");
        }

        // 同じ写真に対して既に指摘済みの場合はエラー
        if (locationSuggestionRepository.existsByPhotoIdAndSuggesterId(photoId, suggester.getId())) {
            throw new IllegalStateException("この写真に対して既に撮影場所の指摘を行っています");
        }

        // Issue#146: 指摘の距離バリデーション（フロントをすり抜けても弾く安全網）。
        // 基準点は写真のスポット座標（指摘ダイアログが赤マーカーで表示している座標と一致させる）。
        validateSuggestionDistance(photo, latitude, longitude);

        LocationSuggestion suggestion = new LocationSuggestion();
        suggestion.setPhotoId(photoId);
        suggestion.setSuggesterId(suggester.getId());
        suggestion.setSuggestedLatitude(latitude);
        suggestion.setSuggestedLongitude(longitude);
        suggestion.setStatus(CodeConstants.SUGGESTION_STATUS_PENDING);

        // 未解決のメール通知済み指摘があるか確認
        boolean hasPendingNotified = locationSuggestionRepository
                .existsByPhotoIdAndStatusAndEmailSent(photoId, CodeConstants.SUGGESTION_STATUS_PENDING, true);

        if (hasPendingNotified) {
            // メール送信しない（投稿者が最初の指摘を解決するまで待つ）
            suggestion.setEmailSent(false);
        } else {
            // メールを送信する
            suggestion.setReviewToken(generateSecureToken());
            boolean sent = sendSuggestionNotification(photo, suggestion);
            suggestion.setEmailSent(sent);
        }

        LocationSuggestion saved = locationSuggestionRepository.save(suggestion);
        logger.info("位置情報の指摘を作成しました: photoId={}, suggesterId={}, emailSent={}",
                photoId, suggester.getId(), saved.isEmailSent());
        return saved;
    }

    /**
     * 指摘を受け入れる
     */
    @Transactional
    public void acceptSuggestion(String reviewToken, String ownerEmail) {
        LocationSuggestion suggestion = findAndValidateSuggestion(reviewToken, ownerEmail);

        // Spotの更新: 指摘された地点に最寄りのSpotを検索、なければ新規作成
        Photo photo = photoRepository.findById(suggestion.getPhotoId())
                .orElseThrow(() -> new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND));

        Spot newSpot = findOrCreateSpot(suggestion.getSuggestedLatitude(), suggestion.getSuggestedLongitude());
        photo.setSpotId(newSpot.getSpotId());
        photo.setLatitude(suggestion.getSuggestedLatitude());
        photo.setLongitude(suggestion.getSuggestedLongitude());
        photoRepository.save(photo);

        resolveSuggestion(suggestion, CodeConstants.SUGGESTION_STATUS_ACCEPTED);

        // 指摘者にメールで承認を通知
        User suggester = userRepository.findById(suggestion.getSuggesterId()).orElse(null);
        if (suggester != null) {
            sendAcceptanceNotification(suggester.getEmail(), suggestion.getPhotoId(), suggester.getLanguage());
        }

        logger.info("位置情報の指摘を受け入れました: suggestionId={}, newSpotId={}",
                suggestion.getId(), newSpot.getSpotId());
    }

    /**
     * Issue#113 グループ C: 指摘承認通知メールを送信。失敗時は WARN ログのみ。
     */
    private void sendAcceptanceNotification(String suggesterEmail, Long photoId, String language) {
        try {
            String link = frontendUrl + "/photo-viewer/" + photoId;
            String subject = emailTemplateService.subject("email.locationSuggestionAccepted", language);
            String body = emailTemplateService.body("email.locationSuggestionAccepted", language, link);
            sendPlainMessage(suggesterEmail, subject, body);
        } catch (Exception e) {
            logger.warn("承認通知メールの送信に失敗しました: error={}", e.getMessage());
        }
    }

    /**
     * 指摘を拒否する
     */
    @Transactional
    public void rejectSuggestion(String reviewToken, String ownerEmail) {
        LocationSuggestion suggestion = findAndValidateSuggestion(reviewToken, ownerEmail);

        resolveSuggestion(suggestion, CodeConstants.SUGGESTION_STATUS_REJECTED);

        // 指摘者にメールで拒否を通知
        User suggester = userRepository.findById(suggestion.getSuggesterId()).orElse(null);
        if (suggester != null) {
            sendRejectionNotification(suggester.getEmail(), suggester.getLanguage());
        }

        logger.info("位置情報の指摘を拒否しました: suggestionId={}", suggestion.getId());
    }

    /**
     * レビュー情報を取得する
     */
    public LocationSuggestion getReviewInfo(String reviewToken, String ownerEmail) {
        return findAndValidateSuggestion(reviewToken, ownerEmail);
    }

    /**
     * レビューページ用のレスポンスDTOを組み立てて返す
     */
    public LocationSuggestionReviewResponse getReviewResponse(String reviewToken, String ownerEmail) {
        LocationSuggestion suggestion = findAndValidateSuggestion(reviewToken, ownerEmail);

        Photo photo = photoRepository.findById(suggestion.getPhotoId()).orElse(null);
        Spot spot = (photo != null) ? spotRepository.findById(photo.getSpotId()).orElse(null) : null;

        LocationSuggestionReviewResponse response = new LocationSuggestionReviewResponse();
        response.setSuggestionId(suggestion.getId());
        response.setSuggestedLatitude(suggestion.getSuggestedLatitude());
        response.setSuggestedLongitude(suggestion.getSuggestedLongitude());
        if (spot != null) {
            response.setCurrentLatitude(spot.getLatitude());
            response.setCurrentLongitude(spot.getLongitude());
        }
        if (photo != null) {
            response.setPhotoTitle(photo.getPlaceName());
            response.setPlaceName(photo.getPlaceName());
            response.setImageUrl(s3Service.generateCdnUrl(photo.getS3ObjectKey()));
            response.setThumbnailUrl(s3Service.generateThumbnailCdnUrl(photo.getS3ObjectKey()));
            response.setCropCenterX(photo.getCropCenterX());
            response.setCropCenterY(photo.getCropCenterY());
            response.setCropZoom(photo.getCropZoom());
            if (photo.getShotAt() != null) {
                response.setShotAt(photo.getShotAt().format(DateTimeFormatter.ISO_DATE_TIME));
            }
            User photoOwner = userRepository.findById(photo.getUserId()).orElse(null);
            if (photoOwner != null) {
                response.setUsername(photoOwner.getUsername());
                // Issue#145: 確認画面に投稿者アイコンを表示するため、プロフィール画像URLを返す
                if (photoOwner.getProfileImageS3Key() != null) {
                    response.setProfileImageUrl(s3Service.generateCdnUrl(photoOwner.getProfileImageS3Key()));
                }
            }
        }
        return response;
    }

    /**
     * ユーザーが指定の写真に対して指摘済みかどうかを返す
     */
    public boolean hasSuggested(Long photoId, String userEmail) {
        User user = userRepository.findByEmail(userEmail)
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));
        return locationSuggestionRepository.existsByPhotoIdAndSuggesterId(photoId, user.getId());
    }

    // ========================================
    // private メソッド
    // ========================================

    private void resolveSuggestion(LocationSuggestion suggestion, int status) {
        suggestion.setStatus(status);
        suggestion.setResolvedAt(LocalDateTime.now());
        locationSuggestionRepository.save(suggestion);
        sendNextPendingEmail(suggestion.getPhotoId());
    }

    private LocationSuggestion findAndValidateSuggestion(String reviewToken, String ownerEmail) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

        LocationSuggestion suggestion = locationSuggestionRepository.findByReviewToken(reviewToken)
                .orElseThrow(() -> new IllegalArgumentException("無効なトークンです"));

        Photo photo = photoRepository.findById(suggestion.getPhotoId())
                .orElseThrow(() -> new PhotoNotFoundException(ERROR_PHOTO_NOT_FOUND));

        if (!photo.getUserId().equals(owner.getId())) {
            throw new AccessDeniedException("この指摘をレビューする権限がありません");
        }

        // Issue#54: QUARANTINED/REMOVED写真への操作をブロック
        if (Integer.valueOf(CodeConstants.MODERATION_STATUS_QUARANTINED).equals(photo.getModerationStatus())) {
            throw new IllegalStateException("この写真は現在審査中のため操作できません");
        }
        if (Integer.valueOf(CodeConstants.MODERATION_STATUS_REMOVED).equals(photo.getModerationStatus())) {
            throw new IllegalStateException("この写真は削除されたため操作できません");
        }

        // Issue#65: 解決済みの指摘への再操作を防止
        if (!Integer.valueOf(CodeConstants.SUGGESTION_STATUS_PENDING).equals(suggestion.getStatus())) {
            throw new IllegalStateException("この指摘は既に解決済みです");
        }

        return suggestion;
    }

    /**
     * Issue#146: 指摘地点の距離をバリデーションする。
     *
     * <p>基準点は写真のスポット座標（指摘ダイアログの赤マーカー＝写真の現在位置）。
     * 元の場所から 30m 未満（近すぎ）は全写真で拒否し、GPS 由来写真は 1km 超（離れすぎ）も
     * 拒否する。GPS なし写真は距離上限なし。スポットが見つからない場合は判定をスキップする。</p>
     *
     * @param photo 指摘対象の写真
     * @param latitude 指摘地点の緯度
     * @param longitude 指摘地点の経度
     */
    private void validateSuggestionDistance(Photo photo, BigDecimal latitude, BigDecimal longitude) {
        Spot spot = spotRepository.findById(photo.getSpotId()).orElse(null);
        if (spot == null || spot.getLatitude() == null || spot.getLongitude() == null) {
            return;
        }

        double meters = haversineMeters(
                spot.getLatitude().doubleValue(), spot.getLongitude().doubleValue(),
                latitude.doubleValue(), longitude.doubleValue());

        if (meters < SUGGESTION_MIN_DISTANCE_METERS) {
            throw new IllegalStateException("元の撮影場所から 30m 以上離れた場所を指定してください");
        }
        if (Boolean.TRUE.equals(photo.getLocationFromExif()) && meters > SUGGESTION_MAX_DISTANCE_METERS) {
            throw new IllegalStateException(
                    "この写真は GPS の位置情報が設定されているため、元の撮影場所から 1km 以内で指定してください");
        }
    }

    /**
     * Haversine 公式で 2 点間の距離をメートルで返す。
     * SpotRepository の検索クエリと同じ地球半径 6371000m を用いる。
     */
    private static double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.pow(Math.sin(dLng / 2), 2);
        return EARTH_RADIUS_METERS * 2 * Math.asin(Math.sqrt(a));
    }

    private Spot findOrCreateSpot(BigDecimal latitude, BigDecimal longitude) {
        List<Spot> nearbySpots = spotRepository.findSpotsWithin200m(latitude, longitude);
        if (!nearbySpots.isEmpty()) {
            return nearbySpots.get(0);
        }
        Spot newSpot = new Spot();
        newSpot.setLatitude(latitude);
        newSpot.setLongitude(longitude);
        newSpot.setCreatedByUserId(0L);
        return spotRepository.save(newSpot);
    }

    private void sendNextPendingEmail(Long photoId) {
        List<LocationSuggestion> pending = locationSuggestionRepository
                .findByPhotoIdAndStatusAndEmailSentOrderByCreatedAtAsc(
                        photoId, CodeConstants.SUGGESTION_STATUS_PENDING, false);

        if (!pending.isEmpty()) {
            LocationSuggestion next = pending.get(0);
            next.setReviewToken(generateSecureToken());

            Photo photo = photoRepository.findById(photoId).orElse(null);
            boolean sent = (photo != null) && sendSuggestionNotification(photo, next);
            next.setEmailSent(sent);
            locationSuggestionRepository.save(next);
        }
    }

    /**
     * Issue#113: 撮影場所指摘通知を写真投稿者に送信。
     *
     * <p>本メソッドは boolean を返す既存の契約を維持する（呼び出し側が emailSent
     * フラグで再送制御するため、グループ A 化せずに既存設計を維持）。失敗時は
     * WARN ログを出して false を返す。</p>
     */
    private boolean sendSuggestionNotification(Photo photo, LocationSuggestion suggestion) {
        try {
            User owner = userRepository.findById(photo.getUserId()).orElse(null);
            if (owner == null) return false;

            String link = frontendUrl + "/review-location?token=" + suggestion.getReviewToken();
            String subject = emailTemplateService.subject("email.locationSuggestion", owner);
            String body = emailTemplateService.body("email.locationSuggestion", owner,
                    owner.getUsername(), link);
            sendPlainMessage(owner.getEmail(), subject, body);
            return true;
        } catch (Exception e) {
            logger.warn("位置情報指摘通知メールの送信に失敗しました: error={}", e.getMessage());
            return false;
        }
    }

    /**
     * Issue#113 グループ C: 指摘拒否通知メールを送信。失敗時は WARN ログのみ。
     */
    private void sendRejectionNotification(String suggesterEmail, String language) {
        try {
            String subject = emailTemplateService.subject("email.locationSuggestionRejected", language);
            String body = emailTemplateService.body("email.locationSuggestionRejected", language);
            sendPlainMessage(suggesterEmail, subject, body);
        } catch (Exception e) {
            logger.warn("拒否通知メールの送信に失敗しました: error={}", e.getMessage());
        }
    }

    /** プレーンテキストメールを送信する共通ヘルパー */
    private void sendPlainMessage(String to, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(mailFrom);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
    }

    private String generateSecureToken() {
        String uuid = UUID.randomUUID().toString() + UUID.randomUUID().toString();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(uuid.getBytes());
    }
}
