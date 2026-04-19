package com.photlas.backend.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Issue#81 Phase 3 - セキュリティ監査ログ集約ロガー。
 *
 * OAuth / 認証まわりのイベントを、専用の logger 名 `com.photlas.backend.security.audit` で
 * 構造化出力する。ログ設定で別ファイル（例: audit.log）に振り分けることを想定。
 *
 * PII（email / access_token / IP など）は呼び出し側で fields マップから除外する前提で、
 * 本クラスは単純に key=value 形式で map の内容を出力する。
 */
@Component
public class SecurityAuditLogger {

    /** Logback / SLF4J で取得する際の logger 名 */
    public static final String LOGGER_NAME = "com.photlas.backend.security.audit";

    private static final Logger logger = LoggerFactory.getLogger(LOGGER_NAME);

    /** 監査イベントの列挙。CloudWatch Logs Insights での集計キーとして使う */
    public enum Event {
        OAUTH_ACCOUNT_CREATED,
        OAUTH_ACCOUNT_LINKED,
        OAUTH_ACCOUNT_RECOVERED,
        OAUTH_LOGIN_SUCCESS,
        OAUTH_LOGIN_FAILED,
        OAUTH_TOKEN_REVOKE_FAILED,
        OAUTH_LINK_CONFIRMED,
        OAUTH_LINK_REJECTED;
    }

    /**
     * 監査イベントを INFO レベルで出力する。
     *
     * @param event  イベント種別
     * @param fields key=value で出力するフィールド（順序が意味を持つ場合は LinkedHashMap を渡す）
     */
    public void log(Event event, Map<String, Object> fields) {
        logger.info(format(event, fields));
    }

    /**
     * 監査イベントを WARN レベルで出力する（revoke 失敗など、注意喚起が必要な場合）。
     */
    public void logWarn(Event event, Map<String, Object> fields) {
        logger.warn(format(event, fields));
    }

    private String format(Event event, Map<String, Object> fields) {
        if (fields == null || fields.isEmpty()) {
            return event.name();
        }
        String keyValue = fields.entrySet().stream()
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining(" "));
        return event.name() + " " + keyValue;
    }
}
