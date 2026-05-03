package com.photlas.backend.service;

import com.photlas.backend.dto.export.*;
import com.photlas.backend.entity.*;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Collections;
import java.util.List;

/**
 * Issue#108: ユーザーのエクスポート対象データをまとめて収集するサービス。
 *
 * <p>ユーザー向けエクスポート（DataExportService）と管理者向けエクスポート
 * （AdminDeletedUserController#exportData）の両方から利用される。</p>
 *
 * <p>DB トランザクションは {@code readOnly = true} とし、ストリーミング処理に入る前に
 * 一度にメモリへ読み込む（§4.14 のトランザクション境界）。</p>
 *
 * <p><b>タイムゾーン:</b> Photlas は LocalDateTime をストレージ層では Asia/Tokyo
 * 基準で扱う（V16 マイグレーション: shot_at を UTC→JST へ変換）。エクスポート
 * 出力では JST → UTC ISO 8601(Z) に変換する（§4.13）。</p>
 */
@Service
public class UserDataCollectorService {

    /** Photlas のストレージ層が想定するタイムゾーン（V16 以降 shot_at は JST 基準）。 */
    private static final ZoneId STORAGE_ZONE = ZoneId.of("Asia/Tokyo");

    private final UserRepository userRepository;
    private final PhotoRepository photoRepository;
    private final FavoriteRepository favoriteRepository;
    private final UserSnsLinkRepository userSnsLinkRepository;
    private final UserOAuthConnectionRepository userOAuthConnectionRepository;
    private final ReportRepository reportRepository;
    private final AccountSanctionRepository accountSanctionRepository;
    private final ViolationRepository violationRepository;
    private final LocationSuggestionRepository locationSuggestionRepository;
    private final SpotRepository spotRepository;

    public UserDataCollectorService(
            UserRepository userRepository,
            PhotoRepository photoRepository,
            FavoriteRepository favoriteRepository,
            UserSnsLinkRepository userSnsLinkRepository,
            UserOAuthConnectionRepository userOAuthConnectionRepository,
            ReportRepository reportRepository,
            AccountSanctionRepository accountSanctionRepository,
            ViolationRepository violationRepository,
            LocationSuggestionRepository locationSuggestionRepository,
            SpotRepository spotRepository) {
        this.userRepository = userRepository;
        this.photoRepository = photoRepository;
        this.favoriteRepository = favoriteRepository;
        this.userSnsLinkRepository = userSnsLinkRepository;
        this.userOAuthConnectionRepository = userOAuthConnectionRepository;
        this.reportRepository = reportRepository;
        this.accountSanctionRepository = accountSanctionRepository;
        this.violationRepository = violationRepository;
        this.locationSuggestionRepository = locationSuggestionRepository;
        this.spotRepository = spotRepository;
    }

    /**
     * 指定ユーザーのエクスポート対象データを 1 回の呼び出しで収集する。
     *
     * @param userId 対象ユーザー ID
     * @return ユーザー本人 + 関連エンティティの集合
     * @throws UserNotFoundException 対象ユーザーが存在しない場合
     */
    @Transactional(readOnly = true)
    public UserExportData collectFor(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません: " + userId));

        return new UserExportData(
                toUserInfo(user),
                toPhotoInfos(userId),
                toFavoriteInfos(userId),
                toSnsLinkInfos(userId),
                toOAuthConnectionInfos(userId),
                toReportInfos(userId),
                toSanctionInfos(userId),
                toViolationInfos(userId),
                toLocationSuggestionInfos(userId),
                toSpotInfos(userId)
        );
    }

    private UserInfo toUserInfo(User user) {
        return new UserInfo(
                user.getUsername(),
                user.getEmail(),
                roleName(user.getRole()),
                user.getLanguage(),
                toUtc(user.getCreatedAt()),
                toUtc(user.getUpdatedAt()),
                toUtc(user.getTermsAgreedAt()),
                toUtc(user.getPrivacyPolicyAgreedAt()),
                user.getOriginalUsername(),
                toUtc(user.getDeletedAt())
        );
    }

    private List<PhotoInfo> toPhotoInfos(Long userId) {
        List<Photo> photos = photoRepository.findByUserIdWithCategoriesOrderByShotAtDesc(userId);
        return photos.stream().map(this::toPhotoInfo).toList();
    }

    private PhotoInfo toPhotoInfo(Photo p) {
        boolean isRemoved = p.getModerationStatus() != null
                && p.getModerationStatus() == CodeConstants.MODERATION_STATUS_REMOVED;
        String fileName = isRemoved ? null : photoFileName(p);

        List<CategoryInfo> categories = p.getCategories() == null
                ? Collections.emptyList()
                : p.getCategories().stream()
                        .map(c -> new CategoryInfo(c.getCategoryId(), c.getName()))
                        .toList();

        return new PhotoInfo(
                p.getPhotoId(),
                fileName,
                p.getS3ObjectKey(),
                p.getModerationStatus(),
                p.getPlaceName(),
                toUtc(p.getShotAt()),
                p.getLatitude(),
                p.getLongitude(),
                p.getWeather(),
                p.getTimeOfDay(),
                p.getDeviceType(),
                categories,
                p.getCameraBody(),
                p.getCameraLens(),
                p.getFocalLength35mm(),
                p.getFValue(),
                p.getShutterSpeed(),
                p.getIso(),
                p.getImageWidth(),
                p.getImageHeight(),
                toUtc(p.getCreatedAt())
        );
    }

    private List<FavoriteInfo> toFavoriteInfos(Long userId) {
        return favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(f -> new FavoriteInfo(f.getPhotoId(), toUtc(f.getCreatedAt())))
                .toList();
    }

    private List<SnsLinkInfo> toSnsLinkInfos(Long userId) {
        return userSnsLinkRepository.findByUserIdOrderBySnsLinkIdDesc(userId).stream()
                .map(s -> new SnsLinkInfo(s.getPlatform(), s.getUrl(), null))
                .toList();
    }

    private List<OAuthConnectionInfo> toOAuthConnectionInfos(Long userId) {
        return userOAuthConnectionRepository.findByUserId(userId).stream()
                .map(c -> new OAuthConnectionInfo(
                        OAuthProvider.fromCode(c.getProviderCode()).getRegistrationId(),
                        c.getEmail(),
                        toUtc(c.getCreatedAt())))
                .toList();
    }

    private List<ReportInfo> toReportInfos(Long userId) {
        return reportRepository.findByReporterUserIdOrderByCreatedAtDesc(userId).stream()
                .map(r -> new ReportInfo(
                        r.getId(),
                        r.getTargetType(),
                        r.getTargetId(),
                        r.getReasonCategory(),
                        r.getReasonText(),
                        toUtc(r.getCreatedAt())))
                .toList();
    }

    private List<SanctionInfo> toSanctionInfos(Long userId) {
        return accountSanctionRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(s -> new SanctionInfo(
                        s.getSanctionType(),
                        toUtc(s.getSuspendedUntil()),
                        toUtc(s.getCreatedAt())))
                .toList();
    }

    private List<ViolationInfo> toViolationInfos(Long userId) {
        return violationRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(v -> new ViolationInfo(
                        v.getTargetType(),
                        v.getTargetId(),
                        v.getViolationType(),
                        v.getActionTaken(),
                        toUtc(v.getCreatedAt())))
                .toList();
    }

    private List<LocationSuggestionInfo> toLocationSuggestionInfos(Long userId) {
        return locationSuggestionRepository.findBySuggesterIdOrderByCreatedAtDesc(userId).stream()
                .map(ls -> new LocationSuggestionInfo(
                        ls.getId(),
                        ls.getPhotoId(),
                        ls.getSuggestedLatitude(),
                        ls.getSuggestedLongitude(),
                        toUtc(ls.getCreatedAt())))
                .toList();
    }

    private List<SpotInfo> toSpotInfos(Long userId) {
        return spotRepository.findByCreatedByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(sp -> new SpotInfo(
                        sp.getSpotId(),
                        sp.getLatitude(),
                        sp.getLongitude(),
                        toUtc(sp.getCreatedAt())))
                .toList();
    }

    /**
     * Photlas のストレージ層に保存されている LocalDateTime（JST 想定）を、
     * 出力用の UTC Instant へ変換する。null は null のまま返す。
     */
    static Instant toUtc(LocalDateTime dt) {
        return dt == null ? null : dt.atZone(STORAGE_ZONE).toInstant();
    }

    /**
     * ZIP 内に格納する写真ファイル名（{photoId}.{拡張子}）を決定する。
     * S3 キーから拡張子を抽出できない場合は ".bin" でフォールバックする。
     */
    static String photoFileName(Photo photo) {
        String s3Key = photo.getS3ObjectKey();
        String ext = "bin";
        if (s3Key != null) {
            int dotIdx = s3Key.lastIndexOf('.');
            if (dotIdx >= 0 && dotIdx < s3Key.length() - 1) {
                ext = s3Key.substring(dotIdx + 1).toLowerCase();
            }
        }
        return "photos/" + photo.getPhotoId() + "." + ext;
    }

    private static String roleName(Integer code) {
        return code == null ? null : CodeConstants.roleToJwtString(code);
    }
}
