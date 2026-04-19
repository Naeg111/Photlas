package com.photlas.backend.util;

import java.util.Map;

/**
 * Issue#81 Phase 3 - セキュリティ監査ログ集約ロガー（Red 段階のスケルトン）。
 *
 * OAuth / 認証まわりのイベントを構造化ログに出力する。PII（email / access_token / IP）は
 * 含めない方針。Green 段階で SLF4J を使った実装を追加する。
 */
public class SecurityAuditLogger {

    /** Logback で取得する際の logger 名（ログ設定で別ファイルに振り分け可能） */
    public static final String LOGGER_NAME = "com.photlas.backend.security.audit";

    /** 監査イベントの列挙（CloudWatch メトリクスでカウントするキー） */
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

    public void log(Event event, Map<String, Object> fields) {
        throw new UnsupportedOperationException("Red 段階: 未実装");
    }

    public void logWarn(Event event, Map<String, Object> fields) {
        throw new UnsupportedOperationException("Red 段階: 未実装");
    }
}
