package com.photlas.backend.service;

import com.photlas.backend.entity.ModerationStatus;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#72: アカウント退会90日後物理削除バッチのテスト
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class AccountCleanupServiceTest {

    @Autowired
    private AccountCleanupService cleanupService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SpotRepository spotRepository;

    @Autowired
    private PhotoRepository photoRepository;

    @Autowired
    private EntityManager entityManager;

    @MockBean
    private S3Service s3Service;

    @BeforeEach
    void setUp() {
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    @DisplayName("Issue#72 - 90日以上経過した退会済みユーザーが物理削除される")
    void testCleanup_DeletesExpiredUsers() {
        User deletedUser = createDeletedUser("expired@example.com", "expired",
                LocalDateTime.now().minusDays(91));

        cleanupService.cleanupDeletedAccounts();

        assertThat(userRepository.findById(deletedUser.getId())).isEmpty();
    }

    @Test
    @DisplayName("Issue#72 - 90日未満の退会済みユーザーは削除されない")
    void testCleanup_KeepsRecentlyDeletedUsers() {
        User recentlyDeleted = createDeletedUser("recent@example.com", "recent",
                LocalDateTime.now().minusDays(89));

        cleanupService.cleanupDeletedAccounts();

        assertThat(userRepository.findById(recentlyDeleted.getId())).isPresent();
    }

    @Test
    @DisplayName("Issue#72 - 物理削除後に孤立スポットが削除される")
    void testCleanup_DeletesOrphanedSpots() {
        // アクティブユーザー（スポットの所有者になる）
        User activeUser = new User();
        activeUser.setUsername("active");
        activeUser.setEmail("active@example.com");
        activeUser.setPasswordHash("hashedpassword");
        activeUser.setRole("USER");
        activeUser = userRepository.save(activeUser);

        // 退会済みユーザー
        User deletedUser = createDeletedUser("orphan@example.com", "orphan",
                LocalDateTime.now().minusDays(91));

        // スポットはアクティブユーザーが所有者（CASCADEで消えないようにする）
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(activeUser.getId());
        spot = spotRepository.save(spot);

        // 退会済みユーザーの写真のみがこのスポットに紐づく
        Photo photo = new Photo();
        photo.setTitle("orphan photo");
        photo.setS3ObjectKey("photos/orphan-" + System.nanoTime() + ".jpg");
        photo.setSpotId(spot.getSpotId());
        photo.setUserId(deletedUser.getId());
        photo.setModerationStatus(ModerationStatus.PUBLISHED);
        photoRepository.save(photo);

        entityManager.flush();
        entityManager.clear();

        Long spotId = spot.getSpotId();

        cleanupService.cleanupDeletedAccounts();

        entityManager.flush();
        entityManager.clear();

        // 退会済みユーザーの物理削除後、写真もCASCADEで削除され、
        // スポットに写真が0件になるため孤立スポットとして削除される
        assertThat(spotRepository.findById(spotId)).isEmpty();
    }

    private User createDeletedUser(String email, String username, LocalDateTime deletedAt) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash("hashedpassword");
        user.setRole("USER");
        user.setDeletedAt(deletedAt);
        user.setOriginalUsername(username);
        return userRepository.save(user);
    }
}
