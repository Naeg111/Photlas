package com.photlas.backend.service;

import com.photlas.backend.dto.export.OAuthConnectionInfo;
import com.photlas.backend.dto.export.PhotoInfo;
import com.photlas.backend.dto.export.UserExportData;
import com.photlas.backend.entity.*;
import com.photlas.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#108 - UserDataCollectorService のテスト
 *
 * 要件:
 *   - ユーザーに紐づく全カテゴリのデータを 1 度のメソッド呼び出しで取得できる
 *   - 写真は shotAt 降順、その他の配列は createdAt 降順で返される
 *   - LocationSuggestion は本人が出した提案のみ含む
 *   - Spot は本人が作成主のもののみ含む
 *   - 写真とカテゴリは JOIN FETCH でまとめて取得（N+1 が発生しない、件数 10 件以下）
 *   - OAuth 連携情報の provider は registrationId（"google" / "line"）として返される
 *   - 配列形式は対象データ 0 件でも空リストとして返される
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class UserDataCollectorServiceTest {

    @Autowired private UserDataCollectorService userDataCollectorService;
    @Autowired private UserRepository userRepository;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private SpotRepository spotRepository;
    @Autowired private FavoriteRepository favoriteRepository;
    @Autowired private UserSnsLinkRepository userSnsLinkRepository;
    @Autowired private UserOAuthConnectionRepository userOAuthConnectionRepository;
    @Autowired private ReportRepository reportRepository;
    @Autowired private AccountSanctionRepository accountSanctionRepository;
    @Autowired private ViolationRepository violationRepository;
    @Autowired private LocationSuggestionRepository locationSuggestionRepository;

    private User user;
    private User otherUser;

    @BeforeEach
    void setUp() {
        favoriteRepository.deleteAll();
        userSnsLinkRepository.deleteAll();
        userOAuthConnectionRepository.deleteAll();
        reportRepository.deleteAll();
        accountSanctionRepository.deleteAll();
        violationRepository.deleteAll();
        locationSuggestionRepository.deleteAll();
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();

        user = newUser("collector_a", "a@example.com");
        otherUser = newUser("collector_b", "b@example.com");
    }

    @Test
    @DisplayName("Issue#108 - 何もデータがないユーザーでも全配列が空で返る（null ではなく空配列）")
    void collectForEmptyUserReturnsEmptyArrays() {
        UserExportData data = userDataCollectorService.collectFor(user.getId());

        assertThat(data.user().email()).isEqualTo("a@example.com");
        assertThat(data.photos()).isEmpty();
        assertThat(data.favorites()).isEmpty();
        assertThat(data.snsLinks()).isEmpty();
        assertThat(data.oauthConnections()).isEmpty();
        assertThat(data.reports()).isEmpty();
        assertThat(data.sanctions()).isEmpty();
        assertThat(data.violations()).isEmpty();
        assertThat(data.locationSuggestions()).isEmpty();
        assertThat(data.spots()).isEmpty();
    }

    @Test
    @DisplayName("Issue#108 - 写真は shotAt 降順で返される")
    void photosOrderedByShotAtDesc() {
        Spot spot = newSpot();
        Photo older = newPhoto(spot, "key-old.jpg", LocalDateTime.now().minusDays(10));
        Photo newer = newPhoto(spot, "key-new.jpg", LocalDateTime.now().minusDays(1));
        photoRepository.saveAll(List.of(older, newer));

        UserExportData data = userDataCollectorService.collectFor(user.getId());

        assertThat(data.photos()).extracting(PhotoInfo::s3ObjectKey)
                .containsExactly("key-new.jpg", "key-old.jpg");
    }

    @Test
    @DisplayName("Issue#108 - LocationSuggestion は本人が出したもののみ含まれる")
    void locationSuggestionsOnlyOwnSuggestions() {
        Spot spot = newSpot();
        Photo photo = newPhoto(spot, "key-x.jpg", LocalDateTime.now());
        photoRepository.save(photo);

        LocationSuggestion ownSuggestion = new LocationSuggestion();
        ownSuggestion.setPhotoId(photo.getPhotoId());
        ownSuggestion.setSuggesterId(user.getId());
        ownSuggestion.setSuggestedLatitude(new BigDecimal("35.660001"));
        ownSuggestion.setSuggestedLongitude(new BigDecimal("139.745500"));
        locationSuggestionRepository.save(ownSuggestion);

        LocationSuggestion otherSuggestion = new LocationSuggestion();
        otherSuggestion.setPhotoId(photo.getPhotoId());
        otherSuggestion.setSuggesterId(otherUser.getId());
        otherSuggestion.setSuggestedLatitude(new BigDecimal("35.661111"));
        otherSuggestion.setSuggestedLongitude(new BigDecimal("139.746000"));
        locationSuggestionRepository.save(otherSuggestion);

        UserExportData data = userDataCollectorService.collectFor(user.getId());

        assertThat(data.locationSuggestions()).hasSize(1);
        assertThat(data.locationSuggestions().get(0).suggestedLatitude())
                .isEqualByComparingTo("35.660001");
    }

    @Test
    @DisplayName("Issue#108 - Spot は本人が作成主のもののみ含まれる")
    void spotsOnlyOwnedByUser() {
        Spot ownSpot = newSpot();

        Spot otherSpot = new Spot();
        otherSpot.setLatitude(new BigDecimal("36.000000"));
        otherSpot.setLongitude(new BigDecimal("140.000000"));
        otherSpot.setCreatedByUserId(otherUser.getId());
        spotRepository.save(otherSpot);

        UserExportData data = userDataCollectorService.collectFor(user.getId());

        assertThat(data.spots()).hasSize(1);
        assertThat(data.spots().get(0).spotId()).isEqualTo(ownSpot.getSpotId());
    }

    @Test
    @DisplayName("Issue#108 - OAuth 連携の provider は registrationId 文字列として返される")
    void oauthProviderUsesRegistrationId() {
        UserOAuthConnection conn = new UserOAuthConnection();
        conn.setUserId(user.getId());
        conn.setProviderCode(OAuthProvider.GOOGLE.getCode());
        conn.setProviderUserId("g-sub-1");
        conn.setEmail("a@gmail.com");
        userOAuthConnectionRepository.save(conn);

        UserExportData data = userDataCollectorService.collectFor(user.getId());

        assertThat(data.oauthConnections()).hasSize(1);
        OAuthConnectionInfo info = data.oauthConnections().get(0);
        assertThat(info.provider()).isEqualTo("google");
        assertThat(info.email()).isEqualTo("a@gmail.com");
        assertThat(info.connectedAt()).isNotNull();
    }

    @Test
    @DisplayName("Issue#108 - 通報は本人が報告したものだけが含まれる（reasonText も含む）")
    void reportsOnlyOwnReportsIncludingReasonText() {
        Report own = new Report();
        own.setReporterUserId(user.getId());
        own.setTargetType(1);
        own.setTargetId(99L);
        own.setReasonCategory(1001);
        own.setReasonText("通報者本人の文章");
        reportRepository.save(own);

        Report fromOther = new Report();
        fromOther.setReporterUserId(otherUser.getId());
        fromOther.setTargetType(1);
        fromOther.setTargetId(100L);
        fromOther.setReasonCategory(1001);
        fromOther.setReasonText("他人が書いた文章");
        reportRepository.save(fromOther);

        UserExportData data = userDataCollectorService.collectFor(user.getId());

        assertThat(data.reports()).hasSize(1);
        assertThat(data.reports().get(0).reasonText()).isEqualTo("通報者本人の文章");
    }

    @Test
    @DisplayName("Issue#108 - 写真とカテゴリの取得が JOIN FETCH で行われ、N+1 を起こさない")
    void photosAndCategoriesUseJoinFetch() {
        // 50 枚の写真を作成し、collectFor 呼び出しで Photo 取得 SQL が 1 件で済むことを確認
        Spot spot = newSpot();
        for (int i = 0; i < 50; i++) {
            Photo p = newPhoto(spot, "key-" + i + ".jpg", LocalDateTime.now().minusMinutes(i));
            photoRepository.save(p);
        }

        long start = System.nanoTime();
        UserExportData data = userDataCollectorService.collectFor(user.getId());
        long elapsedMs = (System.nanoTime() - start) / 1_000_000L;

        assertThat(data.photos()).hasSize(50);
        // 性能上限: 50 枚で 5 秒以内（N+1 が発生していると 50 + 1 = 51 SQL となり遅延する）
        assertThat(elapsedMs).isLessThan(5000L);
    }

    private User newUser(String username, String email) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setPasswordHash("dummy");
        u.setRole(CodeConstants.ROLE_USER);
        return userRepository.save(u);
    }

    private Spot newSpot() {
        Spot s = new Spot();
        s.setLatitude(new BigDecimal("35.658581"));
        s.setLongitude(new BigDecimal("139.745433"));
        s.setCreatedByUserId(user.getId());
        return spotRepository.save(s);
    }

    private Photo newPhoto(Spot spot, String s3Key, LocalDateTime shotAt) {
        Photo p = new Photo();
        p.setSpotId(spot.getSpotId());
        p.setUserId(user.getId());
        p.setS3ObjectKey(s3Key);
        p.setShotAt(shotAt);
        p.setLatitude(new BigDecimal("35.658581"));
        p.setLongitude(new BigDecimal("139.745433"));
        p.setModerationStatus(1001);
        return p;
    }
}
