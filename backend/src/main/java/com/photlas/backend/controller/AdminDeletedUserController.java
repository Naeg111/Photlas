package com.photlas.backend.controller;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.photlas.backend.entity.*;
import com.photlas.backend.repository.*;
import com.photlas.backend.service.AccountCleanupService;
import com.photlas.backend.service.S3Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Issue#73: 退会済みユーザー管理コントローラー
 * 管理者権限を持つユーザーのみアクセス可能
 */
@RestController
@RequestMapping("/api/v1/admin/deleted-users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDeletedUserController {

    private static final Logger logger = LoggerFactory.getLogger(AdminDeletedUserController.class);
    private static final int RETENTION_DAYS = 90;
    private static final String KEY_DELETED_AT = "deleted_at";
    private static final String KEY_ORIGINAL_USERNAME = "original_username";
    private static final String KEY_CREATED_AT = "created_at";

    private final UserRepository userRepository;
    private final PhotoRepository photoRepository;
    private final ViolationRepository violationRepository;
    private final AccountSanctionRepository accountSanctionRepository;
    private final ReportRepository reportRepository;
    private final AccountCleanupService accountCleanupService;
    private final S3Service s3Service;

    public AdminDeletedUserController(
            UserRepository userRepository,
            PhotoRepository photoRepository,
            ViolationRepository violationRepository,
            AccountSanctionRepository accountSanctionRepository,
            ReportRepository reportRepository,
            AccountCleanupService accountCleanupService,
            S3Service s3Service) {
        this.userRepository = userRepository;
        this.photoRepository = photoRepository;
        this.violationRepository = violationRepository;
        this.accountSanctionRepository = accountSanctionRepository;
        this.reportRepository = reportRepository;
        this.accountCleanupService = accountCleanupService;
        this.s3Service = s3Service;
    }

    /**
     * 退会済みユーザー一覧を取得する
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getDeletedUsers(
            @RequestParam(required = false) String search,
            Pageable pageable) {
        Page<User> users;
        if (search != null && !search.isBlank()) {
            users = userRepository.searchDeletedUsers(search, pageable);
        } else {
            users = userRepository.findByDeletedAtIsNotNullOrderByDeletedAtDesc(pageable);
        }

        List<Map<String, Object>> content = users.getContent().stream()
                .map(this::toListItem)
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("content", content);
        response.put("total_elements", users.getTotalElements());
        response.put("total_pages", users.getTotalPages());
        return ResponseEntity.ok(response);
    }

    /**
     * 退会済みユーザー詳細を取得する
     */
    @GetMapping("/{userId}")
    public ResponseEntity<Map<String, Object>> getDeletedUserDetail(@PathVariable Long userId) {
        User user = findDeletedUser(userId);

        List<Photo> photos = photoRepository.findByUserId(user.getId());
        List<Violation> violations = violationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        List<AccountSanction> sanctions = accountSanctionRepository.findByUserIdOrderByCreatedAtDesc(user.getId());

        Map<String, Object> response = new HashMap<>();
        response.put("email", user.getEmail());
        response.put(KEY_ORIGINAL_USERNAME, user.getOriginalUsername());
        response.put(KEY_DELETED_AT, formatDateTime(user.getDeletedAt()));
        response.put("deletion_hold_until", formatDateTime(user.getDeletionHoldUntil()));
        response.put("remaining_days", calculateRemainingDays(user));
        response.put("photo_count", photos.size());
        response.put("violations", violations.stream().map(this::toViolationMap).collect(Collectors.toList()));
        response.put("sanctions", sanctions.stream().map(this::toSanctionMap).collect(Collectors.toList()));

        return ResponseEntity.ok(response);
    }

    /**
     * 退会済みユーザーを即時物理削除する
     */
    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> immediateDelete(
            @PathVariable Long userId,
            @RequestBody Map<String, String> request) {
        User user = findDeletedUser(userId);

        String confirmEmail = request.get("confirm_email");
        if (confirmEmail == null || !confirmEmail.equals(user.getEmail())) {
            return ResponseEntity.badRequest().build();
        }

        accountCleanupService.deleteUserPermanently(user);
        logger.info("Admin immediate delete: userId={}, email={}", userId, user.getEmail());
        return ResponseEntity.noContent().build();
    }

    /**
     * 保持期間を延長する
     */
    @PostMapping("/{userId}/hold")
    public ResponseEntity<Map<String, String>> setHold(
            @PathVariable Long userId,
            @RequestBody Map<String, String> request) {
        User user = findDeletedUser(userId);

        String holdUntil = request.get("hold_until");
        if (holdUntil == null) {
            return ResponseEntity.badRequest().build();
        }

        user.setDeletionHoldUntil(LocalDateTime.parse(holdUntil));
        userRepository.save(user);
        logger.info("Admin set hold: userId={}, holdUntil={}", userId, holdUntil);
        return ResponseEntity.ok(Map.of("message", "保持期間を延長しました"));
    }

    /**
     * 保持期間延長を解除する
     */
    @DeleteMapping("/{userId}/hold")
    public ResponseEntity<Map<String, String>> removeHold(@PathVariable Long userId) {
        User user = findDeletedUser(userId);
        user.setDeletionHoldUntil(null);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "保持期間延長を解除しました"));
    }

    /**
     * データエクスポート
     */
    @GetMapping("/{userId}/export")
    public ResponseEntity<Map<String, Object>> exportData(@PathVariable Long userId) {
        User user = findDeletedUser(userId);

        List<Photo> photos = photoRepository.findByUserId(user.getId());
        List<Violation> violations = violationRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        List<AccountSanction> sanctions = accountSanctionRepository.findByUserIdOrderByCreatedAtDesc(user.getId());

        Map<String, Object> userData = new HashMap<>();
        userData.put("email", user.getEmail());
        userData.put(KEY_ORIGINAL_USERNAME, user.getOriginalUsername());
        userData.put(KEY_CREATED_AT, formatDateTime(user.getCreatedAt()));
        userData.put(KEY_DELETED_AT, formatDateTime(user.getDeletedAt()));

        List<Map<String, Object>> photoData = photos.stream().map(p -> {
            Map<String, Object> m = new HashMap<>();
            m.put("photo_id", p.getPhotoId());
            m.put("title", p.getTitle());
            m.put("moderation_status", p.getModerationStatus().name());
            m.put("shot_at", formatDateTime(p.getShotAt()));
            m.put("latitude", p.getLatitude());
            m.put("longitude", p.getLongitude());
            m.put("camera_body", p.getCameraBody());
            m.put("s3_object_key", p.getS3ObjectKey());
            return m;
        }).collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("user", userData);
        response.put("photos", photoData);
        response.put("violations", violations.stream().map(this::toViolationMap).collect(Collectors.toList()));
        response.put("sanctions", sanctions.stream().map(this::toSanctionMap).collect(Collectors.toList()));

        return ResponseEntity.ok(response);
    }

    private User findDeletedUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new com.photlas.backend.exception.UserNotFoundException("ユーザーが見つかりません"));
        if (user.getDeletedAt() == null) {
            throw new com.photlas.backend.exception.UserNotFoundException("退会済みユーザーではありません");
        }
        return user;
    }

    private Map<String, Object> toListItem(User user) {
        Map<String, Object> item = new HashMap<>();
        item.put("user_id", user.getId());
        item.put("email", user.getEmail());
        item.put(KEY_ORIGINAL_USERNAME, user.getOriginalUsername());
        item.put(KEY_DELETED_AT, formatDateTime(user.getDeletedAt()));
        item.put("remaining_days", calculateRemainingDays(user));
        item.put("hold_active", user.getDeletionHoldUntil() != null &&
                user.getDeletionHoldUntil().isAfter(LocalDateTime.now()));
        return item;
    }

    private long calculateRemainingDays(User user) {
        LocalDateTime deletionDate = user.getDeletedAt().plusDays(RETENTION_DAYS);
        if (user.getDeletionHoldUntil() != null && user.getDeletionHoldUntil().isAfter(deletionDate)) {
            deletionDate = user.getDeletionHoldUntil();
        }
        long days = ChronoUnit.DAYS.between(LocalDateTime.now(), deletionDate);
        return Math.max(0, days);
    }

    private Map<String, Object> toViolationMap(Violation v) {
        Map<String, Object> m = new HashMap<>();
        m.put("violation_type", v.getViolationType());
        m.put("action_taken", v.getActionTaken());
        m.put(KEY_CREATED_AT, formatDateTime(v.getCreatedAt()));
        return m;
    }

    private Map<String, Object> toSanctionMap(AccountSanction s) {
        Map<String, Object> m = new HashMap<>();
        m.put("sanction_type", s.getSanctionType());
        m.put("reason", s.getReason());
        m.put(KEY_CREATED_AT, formatDateTime(s.getCreatedAt()));
        return m;
    }

    private String formatDateTime(LocalDateTime dt) {
        return dt != null ? dt.format(DateTimeFormatter.ISO_DATE_TIME) : null;
    }
}
