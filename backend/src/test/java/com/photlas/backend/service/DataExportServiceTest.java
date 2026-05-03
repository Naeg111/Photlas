package com.photlas.backend.service;

import com.photlas.backend.entity.*;
import com.photlas.backend.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Issue#108 §4.3 §4.5 §4.12 §4.14 - DataExportService のテスト。
 *
 * 範囲:
 *   - ZIP 構成（README / user.json / photos.json / _complete.flag）
 *   - REMOVED 写真は file=null かつ photos/ にエントリ無し
 *   - 成功時の lastExportedAt 更新・exportInProgressAt クリア・data_export_log COMPLETED
 *   - 成功時に通知メールが送られる
 *   - IOException 発生時は FAILED + lastExportedAt は更新されない
 *   - ZIP エントリはすべて DEFLATED
 *   - S3 ダウンロード失敗で 1 回リトライ → 成功すれば写真は含まれる
 *   - S3 ダウンロード 2 回失敗 → errors.json に記録、ZIP は完成する
 *   - 同時実行ロックの原子的取得（tryAcquireExportSlot）の動作
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DataExportServiceTest {

    @Autowired private DataExportService dataExportService;
    @Autowired private UserRepository userRepository;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private SpotRepository spotRepository;
    @Autowired private DataExportLogRepository dataExportLogRepository;

    @MockBean private S3Service s3Service;
    @MockBean private EmailService emailService;

    private User user;

    @BeforeEach
    void setUp() {
        photoRepository.deleteAll();
        spotRepository.deleteAll();
        dataExportLogRepository.deleteAll();
        userRepository.deleteAll();

        user = new User();
        user.setUsername("naegi");
        user.setEmail("naegi@example.com");
        user.setPasswordHash("hash");
        user.setRole(CodeConstants.ROLE_USER);
        user.setLanguage("ja");
        user = userRepository.save(user);

        // S3 download succeeds with empty bytes by default
        when(s3Service.downloadObjectAsBytes(anyString())).thenReturn(new byte[]{0x01, 0x02});
    }

    @Test
    @DisplayName("Issue#108 - ZIP に README.md / user.json / photos.json / _complete.flag が含まれる")
    void zipContainsExpectedEntries() throws Exception {
        DataExportLog log = dataExportService.tryAcquireExportSlot(user.getId(), "192.0.2.1", "UA-test");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        dataExportService.streamExport(log, out);

        Map<String, byte[]> entries = readZip(out.toByteArray());
        // ルートディレクトリ名が photlas-export-{userId}-{timestamp}/ 形式
        String rootDir = entries.keySet().stream()
                .filter(name -> name.startsWith("photlas-export-" + user.getId() + "-"))
                .findFirst()
                .orElseThrow(() -> new AssertionError("root directory not found: " + entries.keySet()));
        // すべての主要エントリが root/ 配下にある
        String prefix = rootDir.split("/", 2)[0] + "/";
        assertThat(entries.keySet()).contains(prefix + "README.md");
        assertThat(entries.keySet()).contains(prefix + "user.json");
        assertThat(entries.keySet()).contains(prefix + "photos.json");
        assertThat(entries.keySet()).contains(prefix + "_complete.flag");
    }

    @Test
    @DisplayName("Issue#108 - 成功時: lastExportedAt 更新 / exportInProgressAt クリア / log COMPLETED / メール送信")
    void onSuccessUpdatesUserAndLogAndSendsEmail() throws Exception {
        DataExportLog log = dataExportService.tryAcquireExportSlot(user.getId(), "192.0.2.1", "UA-test");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        dataExportService.streamExport(log, out);

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getLastExportedAt()).isNotNull();
        assertThat(reloaded.getExportInProgressAt()).isNull();

        DataExportLog reloadedLog = dataExportLogRepository.findById(log.getId()).orElseThrow();
        assertThat(reloadedLog.getStatus()).isEqualTo("COMPLETED");
        assertThat(reloadedLog.getCompletedAt()).isNotNull();

        verify(emailService, times(1)).send(eq("naegi@example.com"), anyString(), anyString());
    }

    @Test
    @DisplayName("Issue#108 - IOException 発生時: log FAILED / lastExportedAt 更新なし / exportInProgressAt クリア / メール送信なし")
    void onIoExceptionMarksFailureWithoutLastExportedAtUpdate() throws Exception {
        DataExportLog log = dataExportService.tryAcquireExportSlot(user.getId(), "192.0.2.1", "UA-test");
        OutputStream broken = new OutputStream() {
            @Override
            public void write(int b) throws IOException {
                throw new IOException("simulated client disconnect");
            }
            @Override
            public void write(byte[] b, int off, int len) throws IOException {
                throw new IOException("simulated client disconnect");
            }
        };

        assertThatThrownBy(() -> dataExportService.streamExport(log, broken))
                .isInstanceOf(IOException.class);

        User reloaded = userRepository.findById(user.getId()).orElseThrow();
        assertThat(reloaded.getLastExportedAt()).isNull();
        assertThat(reloaded.getExportInProgressAt()).isNull();

        DataExportLog reloadedLog = dataExportLogRepository.findById(log.getId()).orElseThrow();
        assertThat(reloadedLog.getStatus()).isEqualTo("FAILED");
        assertThat(reloadedLog.getFailureReason()).contains("simulated client disconnect");

        verify(emailService, never()).send(anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("Issue#108 - REMOVED 写真は photos.json で file=null、photos/ にエントリ無し")
    void removedPhotosAreFilteredFromBinaryZipEntries() throws Exception {
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(user.getId());
        spot = spotRepository.save(spot);

        Photo published = new Photo();
        published.setSpotId(spot.getSpotId());
        published.setUserId(user.getId());
        published.setS3ObjectKey("uploads/" + user.getId() + "/published.jpg");
        published.setLatitude(new BigDecimal("35.658581"));
        published.setLongitude(new BigDecimal("139.745433"));
        published.setShotAt(LocalDateTime.now().minusDays(1));
        published.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        photoRepository.save(published);

        Photo removed = new Photo();
        removed.setSpotId(spot.getSpotId());
        removed.setUserId(user.getId());
        removed.setS3ObjectKey("uploads/" + user.getId() + "/removed.jpg");
        removed.setLatitude(new BigDecimal("35.658581"));
        removed.setLongitude(new BigDecimal("139.745433"));
        removed.setShotAt(LocalDateTime.now().minusDays(2));
        removed.setModerationStatus(CodeConstants.MODERATION_STATUS_REMOVED);
        photoRepository.save(removed);

        DataExportLog log = dataExportService.tryAcquireExportSlot(user.getId(), "192.0.2.1", "UA-test");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        dataExportService.streamExport(log, out);

        Map<String, byte[]> entries = readZip(out.toByteArray());
        String prefix = entries.keySet().stream()
                .filter(name -> name.startsWith("photlas-export-"))
                .map(name -> name.split("/", 2)[0] + "/")
                .findFirst().orElseThrow();

        // PUBLISHED の写真は photos/ に含まれる
        assertThat(entries).containsKey(prefix + "photos/" + published.getPhotoId() + ".jpg");
        // REMOVED の写真は photos/ に含まれない
        assertThat(entries).doesNotContainKey(prefix + "photos/" + removed.getPhotoId() + ".jpg");

        // photos.json を読み、REMOVED 写真は file=null
        String photosJson = new String(entries.get(prefix + "photos.json"), StandardCharsets.UTF_8);
        assertThat(photosJson).contains("\"photoId\":" + published.getPhotoId());
        assertThat(photosJson).contains("\"photoId\":" + removed.getPhotoId());
        // REMOVED の photoId に対応する file は null
        // 簡易的な検証: REMOVED 写真の photoId 周辺で "file":null が存在すること
        int removedIdx = photosJson.indexOf("\"photoId\":" + removed.getPhotoId());
        int publishedIdx = photosJson.indexOf("\"photoId\":" + published.getPhotoId());
        assertThat(removedIdx).isPositive();
        // photos.json のテスト用簡易確認: REMOVED エントリの近傍で "file":null が出現する
        // (具体的位置: removedIdx 周辺 ±200 字を見る)
        int searchStart = Math.max(0, removedIdx - 200);
        int searchEnd = Math.min(photosJson.length(), removedIdx + 200);
        assertThat(photosJson.substring(searchStart, searchEnd)).contains("\"file\":null");
    }

    @Test
    @DisplayName("Issue#108 - ZIP のすべてのエントリが DEFLATED (compression method 8)")
    void allZipEntriesUseDeflated() throws Exception {
        DataExportLog log = dataExportService.tryAcquireExportSlot(user.getId(), "192.0.2.1", "UA-test");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        dataExportService.streamExport(log, out);

        try (ZipInputStream zis = new ZipInputStream(new java.io.ByteArrayInputStream(out.toByteArray()))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                assertThat(entry.getMethod())
                        .as("entry: %s", entry.getName())
                        .isEqualTo(ZipEntry.DEFLATED);
            }
        }
    }

    @Test
    @DisplayName("Issue#108 - 同時実行ロック取得: 2 回目は ExportInProgressException")
    void doubleAcquireExportSlotConflicts() {
        dataExportService.tryAcquireExportSlot(user.getId(), "192.0.2.1", "UA-test");

        assertThatThrownBy(() ->
                dataExportService.tryAcquireExportSlot(user.getId(), "192.0.2.2", "UA-test-2"))
                .isInstanceOf(com.photlas.backend.exception.ExportInProgressException.class);
    }

    @Test
    @DisplayName("Issue#108 - 直近 7 日以内に lastExportedAt がある場合は ExportRateLimitException")
    void rateLimitedWhenRecentlyExported() {
        user.setLastExportedAt(LocalDateTime.now().minusHours(1));
        userRepository.saveAndFlush(user);

        assertThatThrownBy(() ->
                dataExportService.tryAcquireExportSlot(user.getId(), "192.0.2.3", "UA-test"))
                .isInstanceOf(com.photlas.backend.exception.ExportRateLimitException.class);
    }

    @Test
    @DisplayName("Issue#108 - 1 回目失敗 + 2 回目成功で写真が ZIP に含まれる（リトライ動作）")
    void s3DownloadRetriesOnce() throws Exception {
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(user.getId());
        spot = spotRepository.save(spot);

        Photo p = new Photo();
        p.setSpotId(spot.getSpotId());
        p.setUserId(user.getId());
        p.setS3ObjectKey("uploads/" + user.getId() + "/retry.jpg");
        p.setLatitude(new BigDecimal("35.658581"));
        p.setLongitude(new BigDecimal("139.745433"));
        p.setShotAt(LocalDateTime.now());
        p.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        p = photoRepository.save(p);

        when(s3Service.downloadObjectAsBytes(eq(p.getS3ObjectKey())))
                .thenThrow(new RuntimeException("transient"))
                .thenReturn(new byte[]{0x10});

        DataExportLog log = dataExportService.tryAcquireExportSlot(user.getId(), "192.0.2.1", "UA");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        dataExportService.streamExport(log, out);

        Map<String, byte[]> entries = readZip(out.toByteArray());
        String prefix = entries.keySet().stream().filter(n -> n.startsWith("photlas-"))
                .map(n -> n.split("/", 2)[0] + "/").findFirst().orElseThrow();

        assertThat(entries).containsKey(prefix + "photos/" + p.getPhotoId() + ".jpg");
        // 2 回呼ばれている（最初失敗、2 回目成功）
        verify(s3Service, times(2)).downloadObjectAsBytes(p.getS3ObjectKey());
    }

    @Test
    @DisplayName("Issue#108 - 2 回連続失敗ならスキップして errors.json に記録、ZIP は完成する")
    void s3DownloadFailureRecordedInErrorsJson() throws Exception {
        Spot spot = new Spot();
        spot.setLatitude(new BigDecimal("35.658581"));
        spot.setLongitude(new BigDecimal("139.745433"));
        spot.setCreatedByUserId(user.getId());
        spot = spotRepository.save(spot);

        Photo p = new Photo();
        p.setSpotId(spot.getSpotId());
        p.setUserId(user.getId());
        p.setS3ObjectKey("uploads/" + user.getId() + "/dead.jpg");
        p.setLatitude(new BigDecimal("35.658581"));
        p.setLongitude(new BigDecimal("139.745433"));
        p.setShotAt(LocalDateTime.now());
        p.setModerationStatus(CodeConstants.MODERATION_STATUS_PUBLISHED);
        p = photoRepository.save(p);

        when(s3Service.downloadObjectAsBytes(eq(p.getS3ObjectKey())))
                .thenThrow(new RuntimeException("permanent"));

        DataExportLog log = dataExportService.tryAcquireExportSlot(user.getId(), "192.0.2.1", "UA");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        dataExportService.streamExport(log, out);

        Map<String, byte[]> entries = readZip(out.toByteArray());
        String prefix = entries.keySet().stream().filter(n -> n.startsWith("photlas-"))
                .map(n -> n.split("/", 2)[0] + "/").findFirst().orElseThrow();

        assertThat(entries).doesNotContainKey(prefix + "photos/" + p.getPhotoId() + ".jpg");
        String errorsJson = new String(entries.get(prefix + "errors.json"), StandardCharsets.UTF_8);
        assertThat(errorsJson).contains("\"photoId\":" + p.getPhotoId());
        assertThat(errorsJson).contains("\"errorCode\":");
        // _complete.flag は依然存在する
        assertThat(entries).containsKey(prefix + "_complete.flag");
    }

    /**
     * ZIP バイナリを {entryName -> bytes} マップに展開する。
     */
    private static Map<String, byte[]> readZip(byte[] data) throws IOException {
        Map<String, byte[]> result = new HashMap<>();
        try (ZipInputStream zis = new ZipInputStream(new java.io.ByteArrayInputStream(data))) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zis.getNextEntry()) != null) {
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                int n;
                while ((n = zis.read(buffer)) > 0) baos.write(buffer, 0, n);
                result.put(entry.getName(), baos.toByteArray());
            }
        }
        return result;
    }
}
