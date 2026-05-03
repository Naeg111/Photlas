package com.photlas.backend.controller;

import com.photlas.backend.dto.DataExportRequest;
import com.photlas.backend.entity.DataExportLog;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.service.DataExportService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Issue#108 §4.1: ユーザー向けデータエクスポートのエンドポイント。
 *
 * <p>POST /api/v1/users/me/export — リクエストボディの password が必要
 * （OAuth のみユーザーは省略可）。検証順序は
 * 「パスワード → 同時実行 → 頻度制限」（§4.1）。</p>
 */
@RestController
@RequestMapping("/api/v1/users/me")
public class DataExportController {

    private static final Logger logger = LoggerFactory.getLogger(DataExportController.class);

    private static final DateTimeFormatter ZIP_TIMESTAMP_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss'Z'");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final DataExportService dataExportService;

    public DataExportController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            DataExportService dataExportService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.dataExportService = dataExportService;
    }

    /**
     * 認証済みユーザー本人のデータを ZIP で返す。
     */
    @PostMapping("/export")
    public ResponseEntity<StreamingResponseBody> exportData(
            @Valid @RequestBody(required = false) DataExportRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest) {

        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("ユーザーが見つかりません"));

        // 1. パスワード検証（OAuth のみユーザーはスキップ）
        if (user.getPasswordHash() != null) {
            String password = request == null ? null : request.password();
            if (password == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
                throw new UnauthorizedException("パスワードが正しくありません");
            }
        }

        // 2. 同時実行 + 頻度制限の原子的チェック（例外は GlobalExceptionHandler で 409 / 429 へ）
        String requestIp = resolveClientIp(httpRequest);
        String userAgent = httpRequest.getHeader(HttpHeaders.USER_AGENT);
        DataExportLog log = dataExportService.tryAcquireExportSlot(user.getId(), requestIp, userAgent);

        // 3. レスポンスヘッダー組み立て + ZIP ストリーミング開始
        String filename = "photlas-export-" + user.getId() + "-"
                + ZonedDateTime.now(ZoneId.of("UTC")).format(ZIP_TIMESTAMP_FORMATTER)
                + ".zip";

        StreamingResponseBody body = out -> {
            try {
                dataExportService.streamExport(log, out);
            } catch (IOException ioe) {
                logger.warn("Export stream IOException: userId={} message={}",
                        user.getId(), ioe.getMessage());
                throw ioe;
            }
        };

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Accel-Buffering", "no")
                .body(body);
    }

    /** リバースプロキシ越しの場合に X-Forwarded-For 先頭を、無ければ remoteAddr を返す。 */
    private static String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma >= 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }
}
