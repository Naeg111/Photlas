package com.photlas.backend.util;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#81 Phase 3 - SecurityAuditLogger のテスト
 *
 * OAuth / 認証まわりの監査ログを出力する集約ロガー。PII を含めない形で
 * user_id、event、provider などのフィールドを構造化ログに出す。
 */
class SecurityAuditLoggerTest {

    private Logger logger;
    private ListAppender<ILoggingEvent> appender;
    private SecurityAuditLogger auditLogger;

    @BeforeEach
    void setUp() {
        logger = (Logger) LoggerFactory.getLogger(SecurityAuditLogger.LOGGER_NAME);
        appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        logger.setLevel(Level.INFO);
        auditLogger = new SecurityAuditLogger();
    }

    @AfterEach
    void tearDown() {
        logger.detachAppender(appender);
    }

    @Test
    @DisplayName("Issue#81 - OAuth アカウント作成イベントが INFO レベルで監査ログに出力される")
    void logOAuthAccountCreated() {
        auditLogger.log(
                SecurityAuditLogger.Event.OAUTH_ACCOUNT_CREATED,
                Map.of("user_id", 42L, "provider", "GOOGLE")
        );

        assertThat(appender.list).hasSize(1);
        ILoggingEvent evt = appender.list.get(0);
        assertThat(evt.getLevel()).isEqualTo(Level.INFO);
        assertThat(evt.getFormattedMessage())
                .contains("OAUTH_ACCOUNT_CREATED")
                .contains("user_id=42")
                .contains("provider=GOOGLE");
    }

    @Test
    @DisplayName("Issue#81 - OAuth リンクイベントが監査ログに出力される")
    void logOAuthAccountLinked() {
        auditLogger.log(
                SecurityAuditLogger.Event.OAUTH_ACCOUNT_LINKED,
                Map.of("user_id", 1L, "provider", "LINE")
        );

        assertThat(appender.list).hasSize(1);
        assertThat(appender.list.get(0).getFormattedMessage())
                .contains("OAUTH_ACCOUNT_LINKED")
                .contains("provider=LINE");
    }

    @Test
    @DisplayName("Issue#81 - OAuth リボークイベントが WARN レベルで出力される（失敗時）")
    void logOAuthRevokeFailure() {
        auditLogger.logWarn(
                SecurityAuditLogger.Event.OAUTH_TOKEN_REVOKE_FAILED,
                Map.of("user_id", 7L, "provider", "GOOGLE", "reason", "http_timeout")
        );

        assertThat(appender.list).hasSize(1);
        ILoggingEvent evt = appender.list.get(0);
        assertThat(evt.getLevel()).isEqualTo(Level.WARN);
        assertThat(evt.getFormattedMessage())
                .contains("OAUTH_TOKEN_REVOKE_FAILED")
                .contains("reason=http_timeout");
    }

    @Test
    @DisplayName("Issue#81 - PII（email / access_token / ipv4）は監査ログに含まれない")
    void logDoesNotContainPii() {
        auditLogger.log(
                SecurityAuditLogger.Event.OAUTH_ACCOUNT_CREATED,
                Map.of("user_id", 99L, "provider", "GOOGLE")
        );

        String logLine = appender.list.get(0).getFormattedMessage();
        assertThat(logLine).doesNotContain("@"); // email
        assertThat(logLine).doesNotContainIgnoringCase("access_token");
    }

    @Test
    @DisplayName("Issue#81 - 複数フィールドが key=value 形式で順序安定に出力される")
    void logFormatsFieldsStably() {
        auditLogger.log(
                SecurityAuditLogger.Event.OAUTH_ACCOUNT_RECOVERED,
                new java.util.LinkedHashMap<>() {{
                    put("user_id", 5L);
                    put("provider", "LINE");
                    put("deletion_hold_expires_at", "2026-05-01T00:00:00");
                }}
        );

        String logLine = appender.list.get(0).getFormattedMessage();
        int idxUser = logLine.indexOf("user_id=5");
        int idxProvider = logLine.indexOf("provider=LINE");
        int idxHold = logLine.indexOf("deletion_hold_expires_at=");
        assertThat(idxUser).isGreaterThanOrEqualTo(0);
        assertThat(idxProvider).isGreaterThan(idxUser);
        assertThat(idxHold).isGreaterThan(idxProvider);
    }
}
