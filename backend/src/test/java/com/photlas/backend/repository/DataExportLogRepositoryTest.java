package com.photlas.backend.repository;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.DataExportLog;
import com.photlas.backend.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#108 - DataExportLogRepository のテスト
 *
 * 要件:
 *   - エクスポート処理開始時に IN_PROGRESS で行を作成・取得できる
 *   - 完了時に COMPLETED へ更新できる（completed_at, photo_count, estimated_size_bytes）
 *   - 失敗時に FAILED へ更新できる（failure_reason）
 *   - 同一ユーザーの履歴を新しい順に取得できる
 *   - request_ip / user_agent を保存できる
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DataExportLogRepositoryTest {

    @Autowired
    private DataExportLogRepository dataExportLogRepository;

    @Autowired
    private UserRepository userRepository;

    private User user;

    @BeforeEach
    void setUp() {
        dataExportLogRepository.deleteAll();
        userRepository.deleteAll();

        user = new User();
        user.setUsername("exportuser");
        user.setEmail("export@example.com");
        user.setPasswordHash("dummy-hash");
        user.setRole(CodeConstants.ROLE_USER);
        user = userRepository.save(user);
    }

    @Test
    @DisplayName("Issue#108 - IN_PROGRESS のエクスポート履歴を作成・取得できる")
    void createAndFindInProgressLog() {
        DataExportLog log = new DataExportLog();
        log.setUserId(user.getId());
        log.setRequestedAt(LocalDateTime.now());
        log.setStatus(DataExportLog.STATUS_IN_PROGRESS);
        log.setRequestIp("192.0.2.1");
        log.setUserAgent("Mozilla/5.0 (Test)");

        DataExportLog saved = dataExportLogRepository.save(log);
        assertThat(saved.getId()).isNotNull();

        Optional<DataExportLog> reloaded = dataExportLogRepository.findById(saved.getId());
        assertThat(reloaded).isPresent();
        assertThat(reloaded.get().getStatus()).isEqualTo("IN_PROGRESS");
        assertThat(reloaded.get().getRequestIp()).isEqualTo("192.0.2.1");
        assertThat(reloaded.get().getUserAgent()).isEqualTo("Mozilla/5.0 (Test)");
        assertThat(reloaded.get().getCompletedAt()).isNull();
        assertThat(reloaded.get().getPhotoCount()).isNull();
        assertThat(reloaded.get().getEstimatedSizeBytes()).isNull();
        assertThat(reloaded.get().getFailureReason()).isNull();
    }

    @Test
    @DisplayName("Issue#108 - エクスポート履歴を COMPLETED へ更新できる")
    void updateLogToCompleted() {
        DataExportLog log = new DataExportLog();
        log.setUserId(user.getId());
        log.setRequestedAt(LocalDateTime.now());
        log.setStatus(DataExportLog.STATUS_IN_PROGRESS);
        log = dataExportLogRepository.save(log);

        log.setStatus(DataExportLog.STATUS_COMPLETED);
        log.setCompletedAt(LocalDateTime.now());
        log.setPhotoCount(42);
        log.setEstimatedSizeBytes(123_456_789L);
        dataExportLogRepository.save(log);

        DataExportLog reloaded = dataExportLogRepository.findById(log.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("COMPLETED");
        assertThat(reloaded.getCompletedAt()).isNotNull();
        assertThat(reloaded.getPhotoCount()).isEqualTo(42);
        assertThat(reloaded.getEstimatedSizeBytes()).isEqualTo(123_456_789L);
    }

    @Test
    @DisplayName("Issue#108 - エクスポート履歴を FAILED へ更新できる（failure_reason 含む）")
    void updateLogToFailed() {
        DataExportLog log = new DataExportLog();
        log.setUserId(user.getId());
        log.setRequestedAt(LocalDateTime.now());
        log.setStatus(DataExportLog.STATUS_IN_PROGRESS);
        log = dataExportLogRepository.save(log);

        log.setStatus(DataExportLog.STATUS_FAILED);
        log.setFailureReason("Client disconnected: connection reset");
        dataExportLogRepository.save(log);

        DataExportLog reloaded = dataExportLogRepository.findById(log.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("FAILED");
        assertThat(reloaded.getFailureReason()).isEqualTo("Client disconnected: connection reset");
    }

    @Test
    @DisplayName("Issue#108 - ユーザーの履歴を新しい順で取得できる")
    void findByUserIdOrderedByRequestedAtDesc() {
        LocalDateTime base = LocalDateTime.now().minusDays(10);
        for (int i = 0; i < 3; i++) {
            DataExportLog log = new DataExportLog();
            log.setUserId(user.getId());
            log.setRequestedAt(base.plusDays(i));
            log.setStatus(DataExportLog.STATUS_COMPLETED);
            dataExportLogRepository.save(log);
        }

        List<DataExportLog> logs = dataExportLogRepository.findByUserIdOrderByRequestedAtDesc(user.getId());

        assertThat(logs).hasSize(3);
        assertThat(logs.get(0).getRequestedAt()).isAfter(logs.get(1).getRequestedAt());
        assertThat(logs.get(1).getRequestedAt()).isAfter(logs.get(2).getRequestedAt());
    }

    @Test
    @DisplayName("Issue#108 - failure_reason は最大 1000 文字まで保存可能")
    void failureReasonAllowsUpTo1000Chars() {
        DataExportLog log = new DataExportLog();
        log.setUserId(user.getId());
        log.setRequestedAt(LocalDateTime.now());
        log.setStatus(DataExportLog.STATUS_FAILED);
        log.setFailureReason("a".repeat(1000));

        DataExportLog saved = dataExportLogRepository.saveAndFlush(log);
        DataExportLog reloaded = dataExportLogRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getFailureReason()).hasSize(1000);
    }
}
