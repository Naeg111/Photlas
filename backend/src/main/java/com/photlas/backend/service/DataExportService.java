package com.photlas.backend.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.photlas.backend.dto.export.PhotoInfo;
import com.photlas.backend.dto.export.UserExportData;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.DataExportLog;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.ExportInProgressException;
import com.photlas.backend.exception.ExportRateLimitException;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.DataExportLogRepository;
import com.photlas.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.OutputStream;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Issue#108: ユーザー向けデータエクスポートのコアサービス。
 *
 * <p>Controller から下記の流れで呼ばれる想定:
 * <ol>
 *   <li>{@link #tryAcquireExportSlot(Long, String, String)} — 同時実行ロックと
 *       頻度制限の原子的取得</li>
 *   <li>{@link #streamExport(DataExportLog, OutputStream)} — ZIP をストリーミングで
 *       OutputStream に書き出す</li>
 * </ol>
 * 成功時は {@code lastExportedAt} 更新・通知メール送信を行う。
 * IOException 等で中断した場合は {@code data_export_log} を FAILED にし、
 * {@code lastExportedAt} は更新せず {@code exportInProgressAt} のみクリアする。</p>
 */
@Service
public class DataExportService {

    private static final Logger logger = LoggerFactory.getLogger(DataExportService.class);

    /** 進行中フラグのストール閾値（§4.5）。 */
    private static final Duration STALE_THRESHOLD = Duration.ofMinutes(30);

    /** 頻度制限ウィンドウ（§4.5: 168 時間 = 1 週間）。 */
    private static final Duration RATE_LIMIT_WINDOW = Duration.ofHours(168);

    /** 巨大データ警告閾値（§4.3）。 */
    private static final long LARGE_EXPORT_THRESHOLD_BYTES = 10L * 1024 * 1024 * 1024;

    /** S3 ダウンロードの追加リトライ回数（AWS SDK の自動リトライに加えて）。 */
    private static final int S3_RETRY_ATTEMPTS = 1;

    /** failure_reason の最大長（VARCHAR(1000) 制約）。 */
    private static final int FAILURE_REASON_MAX_LENGTH = 1000;

    private static final DateTimeFormatter ZIP_TIMESTAMP_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss'Z'");

    private final UserRepository userRepository;
    private final DataExportLogRepository dataExportLogRepository;
    private final UserDataCollectorService userDataCollectorService;
    private final S3Service s3Service;
    private final EmailService emailService;
    private final DataExportTemplateService templateService;
    private final ObjectMapper objectMapper;

    public DataExportService(
            UserRepository userRepository,
            DataExportLogRepository dataExportLogRepository,
            UserDataCollectorService userDataCollectorService,
            S3Service s3Service,
            EmailService emailService,
            DataExportTemplateService templateService) {
        this.userRepository = userRepository;
        this.dataExportLogRepository = dataExportLogRepository;
        this.userDataCollectorService = userDataCollectorService;
        this.s3Service = s3Service;
        this.emailService = emailService;
        this.templateService = templateService;
        this.objectMapper = buildObjectMapper();
    }

    /**
     * 同時実行ロック + 頻度制限の原子的チェックと取得（§4.5）。
     *
     * @return 作成された {@link DataExportLog}（IN_PROGRESS）
     * @throws ExportInProgressException 既に進行中
     * @throws ExportRateLimitException  168 時間以内に成功エクスポート済み
     */
    @Transactional
    public DataExportLog tryAcquireExportSlot(Long userId, String requestIp, String userAgent) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime staleCutoff = now.minus(STALE_THRESHOLD);
        LocalDateTime recentCutoff = now.minus(RATE_LIMIT_WINDOW);

        int updated = userRepository.tryAcquireExportSlot(userId, now, staleCutoff, recentCutoff);
        if (updated == 0) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません: " + userId));
            if (user.getExportInProgressAt() != null
                    && user.getExportInProgressAt().isAfter(staleCutoff)) {
                throw new ExportInProgressException("別タブでエクスポートが進行中です");
            }
            if (user.getLastExportedAt() != null
                    && user.getLastExportedAt().isAfter(recentCutoff)) {
                Duration retryAfter = Duration.between(now,
                        user.getLastExportedAt().plus(RATE_LIMIT_WINDOW));
                throw new ExportRateLimitException(
                        "エクスポートは 168 時間に 1 回までです", retryAfter);
            }
            // 念のためのフォールバック（理論上は到達しない）
            throw new ExportInProgressException("エクスポート開始に失敗しました");
        }

        DataExportLog log = new DataExportLog();
        log.setUserId(userId);
        log.setRequestedAt(now);
        log.setStatus(DataExportLog.STATUS_IN_PROGRESS);
        log.setRequestIp(requestIp);
        log.setUserAgent(userAgent);
        return dataExportLogRepository.save(log);
    }

    /**
     * ZIP を OutputStream にストリーミングで書き出す。
     *
     * <p>このメソッドは @Transactional を付けない。ストリーミング全体で
     * トランザクションを開きっぱなしにすると DB コネクションを長時間占有する
     * ためである（§4.14）。データ取得・完了/失敗時の DB 更新は内部の
     * 別メソッドで個別に短いトランザクションで行う。</p>
     *
     * @throws IOException OutputStream 書き込み中の I/O 例外（通常はクライアント切断）
     */
    public void streamExport(DataExportLog logEntry, OutputStream out) throws IOException {
        UserExportData data = userDataCollectorService.collectFor(logEntry.getUserId());
        long estimatedSize = estimateSize(data);
        if (estimatedSize >= LARGE_EXPORT_THRESHOLD_BYTES) {
            logger.warn("Export started for large user: userId={} estimatedSizeBytes={}",
                    logEntry.getUserId(), estimatedSize);
        } else {
            logger.info("Export started: userId={} photoCount={} estimatedSizeBytes={}",
                    logEntry.getUserId(), data.photos().size(), estimatedSize);
        }

        try {
            ZonedDateTime nowUtc = ZonedDateTime.now(ZoneId.of("UTC"));
            String rootDir = "photlas-export-" + logEntry.getUserId() + "-"
                    + nowUtc.format(ZIP_TIMESTAMP_FORMATTER) + "/";

            try (ZipOutputStream zos = new ZipOutputStream(out)) {
                zos.setLevel(java.util.zip.Deflater.DEFAULT_COMPRESSION);

                String language = data.user().language();
                writeStringEntry(zos, rootDir + "README.md",
                        templateService.renderReadme(language, data.user().username(), nowUtc));
                writeJsonEntry(zos, rootDir + "user.json", data.user());
                writeJsonEntry(zos, rootDir + "favorites.json", data.favorites());
                writeJsonEntry(zos, rootDir + "sns_links.json", data.snsLinks());
                writeJsonEntry(zos, rootDir + "oauth.json", data.oauthConnections());
                writeJsonEntry(zos, rootDir + "reports.json", data.reports());
                writeJsonEntry(zos, rootDir + "sanctions.json", data.sanctions());
                writeJsonEntry(zos, rootDir + "violations.json", data.violations());
                writeJsonEntry(zos, rootDir + "location_suggestions.json", data.locationSuggestions());
                writeJsonEntry(zos, rootDir + "spots.json", data.spots());

                List<ExportError> errors = writePhotoBinaries(zos, rootDir, data.photos());
                writeJsonEntry(zos, rootDir + "photos.json", data.photos());
                writeJsonEntry(zos, rootDir + "errors.json", errors);

                ZipEntry completeFlag = new ZipEntry(rootDir + "_complete.flag");
                completeFlag.setMethod(ZipEntry.DEFLATED);
                zos.putNextEntry(completeFlag);
                zos.closeEntry();

                zos.finish();
            }

            markCompleted(logEntry, data.photos().size(), estimatedSize);
            sendCompletionEmailQuietly(logEntry, data, nowUtc);
            logger.info("Export completed: userId={} logId={}", logEntry.getUserId(), logEntry.getId());

        } catch (IOException ioe) {
            String reason = "Client disconnected: " + ioe.getMessage();
            markFailed(logEntry, reason);
            logger.warn("Export failed: userId={} reason={}", logEntry.getUserId(), reason);
            throw ioe;
        } catch (RuntimeException re) {
            String reason = re.getClass().getSimpleName() + ": " + re.getMessage();
            markFailed(logEntry, reason);
            logger.warn("Export failed: userId={} reason={}", logEntry.getUserId(), reason);
            throw re;
        }
    }

    /**
     * REMOVED 以外の各写真について S3 から取得して ZIP に書き込む。
     * S3 取得に 1 回追加リトライ。最終失敗は errors.json に記録してスキップする。
     */
    private List<ExportError> writePhotoBinaries(
            ZipOutputStream zos, String rootDir, List<PhotoInfo> photos) throws IOException {
        List<ExportError> errors = new ArrayList<>();
        for (PhotoInfo photo : photos) {
            if (photo.moderationStatus() != null
                    && photo.moderationStatus() == CodeConstants.MODERATION_STATUS_REMOVED) {
                continue;
            }
            String s3Key = photo.s3ObjectKey();
            if (s3Key == null) continue;

            byte[] data = downloadWithRetry(s3Key, errors, photo.photoId());
            if (data == null) continue;

            ZipEntry entry = new ZipEntry(rootDir + photo.file());
            entry.setMethod(ZipEntry.DEFLATED);
            zos.putNextEntry(entry);
            zos.write(data);
            zos.closeEntry();
        }
        return errors;
    }

    /**
     * S3 ダウンロードを最大 (1 + S3_RETRY_ATTEMPTS) 回試行する。最終失敗時は
     * errors リストにエラーレコードを追加し null を返す。
     */
    private byte[] downloadWithRetry(String s3Key, List<ExportError> errors, Long photoId) {
        Throwable last = null;
        for (int attempt = 0; attempt <= S3_RETRY_ATTEMPTS; attempt++) {
            try {
                return s3Service.downloadObjectAsBytes(s3Key);
            } catch (RuntimeException e) {
                last = e;
            }
        }
        errors.add(new ExportError(photoId, classifyError(last),
                last == null ? "" : last.getMessage()));
        return null;
    }

    private String classifyError(Throwable t) {
        if (t == null) return "INTERNAL_ERROR";
        String name = t.getClass().getSimpleName();
        if (name.contains("NoSuchKey")) return "S3_NOT_FOUND";
        if (name.contains("Timeout")) return "S3_TIMEOUT";
        if (name.contains("AccessDenied")) return "S3_ACCESS_DENIED";
        return "INTERNAL_ERROR";
    }

    private void writeStringEntry(ZipOutputStream zos, String name, String content) throws IOException {
        ZipEntry entry = new ZipEntry(name);
        entry.setMethod(ZipEntry.DEFLATED);
        zos.putNextEntry(entry);
        zos.write(content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        zos.closeEntry();
    }

    private void writeJsonEntry(ZipOutputStream zos, String name, Object value) throws IOException {
        ZipEntry entry = new ZipEntry(name);
        entry.setMethod(ZipEntry.DEFLATED);
        zos.putNextEntry(entry);
        objectMapper.writeValue(zos, value);
        zos.closeEntry();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markCompleted(DataExportLog log, int photoCount, long estimatedSize) {
        LocalDateTime now = LocalDateTime.now();

        DataExportLog persisted = dataExportLogRepository.findById(log.getId()).orElseThrow();
        persisted.setStatus(DataExportLog.STATUS_COMPLETED);
        persisted.setCompletedAt(now);
        persisted.setPhotoCount(photoCount);
        persisted.setEstimatedSizeBytes(estimatedSize);
        dataExportLogRepository.save(persisted);

        User user = userRepository.findById(log.getUserId()).orElseThrow();
        user.setLastExportedAt(now);
        user.setExportInProgressAt(null);
        userRepository.save(user);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(DataExportLog log, String reason) {
        DataExportLog persisted = dataExportLogRepository.findById(log.getId()).orElseThrow();
        persisted.setStatus(DataExportLog.STATUS_FAILED);
        persisted.setFailureReason(truncate(reason, FAILURE_REASON_MAX_LENGTH));
        dataExportLogRepository.save(persisted);

        User user = userRepository.findById(log.getUserId()).orElseThrow();
        user.setExportInProgressAt(null);
        userRepository.save(user);
    }

    private void sendCompletionEmailQuietly(
            DataExportLog logEntry, UserExportData data, ZonedDateTime nowUtc) {
        try {
            String subject = templateService.renderEmailSubject(data.user().language());
            String body = templateService.renderEmailBody(
                    data.user().language(),
                    data.user().username(),
                    nowUtc,
                    logEntry.getRequestIp(),
                    logEntry.getUserAgent());
            emailService.send(data.user().email(), subject, body);
        } catch (Exception e) {
            logger.warn("Failed to send export complete notification email: userId={} error={}",
                    logEntry.getUserId(), e.getMessage());
        }
    }

    /** 写真サイズの大雑把な見積もり。S3 を叩かず Photo メタデータの imageWidth × height で代用。 */
    private long estimateSize(UserExportData data) {
        long total = 0;
        for (PhotoInfo p : data.photos()) {
            if (p.imageWidth() != null && p.imageHeight() != null) {
                // 1 ピクセル ≒ 0.5 byte（JPEG 圧縮率の概算）
                total += (long) p.imageWidth() * p.imageHeight() / 2;
            } else {
                total += 5L * 1024 * 1024;
            }
        }
        return total;
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static ObjectMapper buildObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        mapper.setSerializationInclusion(JsonInclude.Include.ALWAYS);
        // ZipOutputStream を Jackson に閉じさせない（次のエントリ書き込みのため開いたままにする）
        mapper.getFactory().disable(com.fasterxml.jackson.core.JsonGenerator.Feature.AUTO_CLOSE_TARGET);
        return mapper;
    }

    /** errors.json のエントリ。 */
    private record ExportError(Long photoId, String errorCode, String message) {}
}
