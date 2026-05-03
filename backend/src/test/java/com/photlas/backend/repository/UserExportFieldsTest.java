package com.photlas.backend.repository;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#108 - User エンティティに追加されるエクスポート関連フィールドのテスト
 *
 * 要件:
 *   - users.last_exported_at カラムが永続化される
 *   - users.export_in_progress_at カラムが永続化される
 *   - 既存ユーザーは初期状態で両カラムとも null（マイグレーション後の互換性）
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class UserExportFieldsTest {

    @Autowired
    private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        user = new User();
        user.setUsername("exportflds");
        user.setEmail("flds@example.com");
        user.setPasswordHash("dummy-hash");
        user.setRole(CodeConstants.ROLE_USER);
        user = userRepository.save(user);
    }

    @Test
    @DisplayName("Issue#108 - 新規ユーザーの lastExportedAt / exportInProgressAt は null")
    void newUserHasNullExportFields() {
        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getLastExportedAt()).isNull();
        assertThat(reloaded.getExportInProgressAt()).isNull();
    }

    @Test
    @DisplayName("Issue#108 - lastExportedAt を保存・取得できる")
    void canSaveAndLoadLastExportedAt() {
        LocalDateTime exportedAt = LocalDateTime.now().minusDays(2);
        user.setLastExportedAt(exportedAt);
        userRepository.saveAndFlush(user);

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getLastExportedAt()).isNotNull();
    }

    @Test
    @DisplayName("Issue#108 - exportInProgressAt を保存・取得できる")
    void canSaveAndLoadExportInProgressAt() {
        LocalDateTime now = LocalDateTime.now();
        user.setExportInProgressAt(now);
        userRepository.saveAndFlush(user);

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getExportInProgressAt()).isNotNull();
    }

    @Test
    @DisplayName("Issue#108 - exportInProgressAt を null に戻せる（クリア）")
    void canClearExportInProgressAt() {
        user.setExportInProgressAt(LocalDateTime.now());
        userRepository.saveAndFlush(user);

        user.setExportInProgressAt(null);
        userRepository.saveAndFlush(user);

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getExportInProgressAt()).isNull();
    }
}
