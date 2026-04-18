package com.photlas.backend.filter;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.photlas.backend.config.RateLimitConfig;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Set;

/**
 * API レート制限フィルタ
 * Issue#22: API Rate Limiting の実装
 * Issue#95: カテゴリ整理（sensitive 新設・フォールバック方式・URL デコード対策・JSON ボディ）
 *
 * Token Bucket アルゴリズムでエンドポイント別のレート制限を適用する。
 * Caffeine キャッシュにより、一定時間アクセスがないエントリは自動的に削除される。
 *
 * カテゴリ判定の優先度:
 *   1. SENSITIVE_PATHS（完全一致） → sensitive (3 req/分)
 *   2. /api/v1/auth/* 以下         → auth      (10 req/分, フォールバック含む)
 *   3. /api/v1/photos または /api/v1/photos/ 配下 → photo (30 req/分)
 *   4. 上記以外                     → general   (80 req/分)
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(RateLimitFilter.class);

    /**
     * センシティブなエンドポイント（完全一致）
     * メール送信や外部通知などコスト／悪用リスクの高いもの。
     * Issue#95: auth カテゴリから切り出して 3 req/分の厳格制限を適用する。
     */
    private static final Set<String> SENSITIVE_PATHS = Set.of(
            "/api/v1/auth/password-reset-request",
            "/api/v1/auth/resend-verification"
    );

    // エンドポイントパス定数
    private static final String AUTH_PATH_PREFIX = "/api/v1/auth/";
    private static final String PHOTO_PATH_EXACT = "/api/v1/photos";
    private static final String PHOTO_PATH_PREFIX = "/api/v1/photos/";

    // ユーザー識別子プレフィックス
    private static final String USER_PREFIX = "user:";
    private static final String IP_PREFIX = "ip:";
    private static final String ANONYMOUS_USER = "anonymousUser";

    // HTTP ヘッダー
    private static final String X_FORWARDED_FOR_HEADER = "X-Forwarded-For";
    private static final String RETRY_AFTER_HEADER = "Retry-After";
    private static final String RETRY_AFTER_SECONDS = "60";

    /**
     * 429 レスポンスの JSON ボディ。
     * Issue#95: WAF（Issue#94）の CustomResponseBodies と同一構造に揃えて、
     * CDN 層／アプリ層どちらで弾かれてもクライアント側で同じハンドリングができるようにする。
     */
    private static final String RATE_LIMIT_EXCEEDED_JSON_BODY =
            "{\"error\":\"Too Many Requests\","
            + "\"code\":\"RATE_LIMIT_EXCEEDED\","
            + "\"message\":\"Too many requests. Please retry after some time.\","
            + "\"retryAfter\":60}";

    /** キャッシュの TTL: 最終アクセスから 10 分 */
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);

    /** 多重エンコード防御時のデコード反復上限 */
    private static final int URL_DECODE_MAX_ITERATIONS = 3;

    /**
     * ユーザー／IP ごとの Bucket を管理するキャッシュ（TTL 付き）。
     * 最終アクセスから 10 分経過したエントリは自動的に削除される。
     */
    private Cache<String, Bucket> bucketCache = Caffeine.newBuilder()
            .expireAfterAccess(CACHE_TTL)
            .build();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        String requestPath = resolveRequestPath(request);
        int rateLimit = determineRateLimit(requestPath);
        String userIdentifier = getUserIdentifier(request);
        String cacheKey = rateLimit + ":" + userIdentifier;

        Bucket bucket = bucketCache.get(cacheKey, k -> RateLimitConfig.createBucket(rateLimit));

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            handleRateLimitExceeded(response, userIdentifier, requestPath, rateLimit);
        }
    }

    /**
     * リクエストパスを解決する。
     * Issue#95: /api/v1/auth/password%2Dreset%2Drequest のような URL エンコードでの
     * SENSITIVE_PATHS 回避攻撃を防ぐため、getServletPath()（本番では通常デコード済み）を優先し、
     * さらに明示的に URL デコードを最大 3 回まで反復して正規化する。
     *
     * 多重エンコード（例: "-" → "%2D" → "%252D"）されたケースにも対応するため、
     * パスが変化しなくなるまで、または 3 回に達するまで繰り返しデコードする。
     * （MockMvc が URL テンプレートを再エンコードすることによる % の二重化や、
     *   リバースプロキシの設定違いを吸収するための防御的処理。）
     */
    private String resolveRequestPath(HttpServletRequest request) {
        String rawPath = request.getServletPath();
        if (rawPath == null || rawPath.isEmpty()) {
            rawPath = request.getRequestURI();
        }
        if (rawPath == null) {
            return "";
        }
        String current = rawPath;
        for (int i = 0; i < URL_DECODE_MAX_ITERATIONS; i++) {
            if (current.indexOf('%') < 0) {
                return current;
            }
            String decoded;
            try {
                decoded = URLDecoder.decode(current, StandardCharsets.UTF_8);
            } catch (IllegalArgumentException malformed) {
                return current;
            }
            if (decoded.equals(current)) {
                return current;
            }
            current = decoded;
        }
        return current;
    }

    private void handleRateLimitExceeded(HttpServletResponse response, String userIdentifier,
                                          String requestPath, int rateLimit) throws IOException {
        logger.warn("レート制限超過: user={}, path={}, limit={}/min", userIdentifier, requestPath, rateLimit);
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(RETRY_AFTER_HEADER, RETRY_AFTER_SECONDS);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write(RATE_LIMIT_EXCEEDED_JSON_BODY);
    }

    /**
     * リクエストパスに基づいてレート制限を決定する。
     * 判定順: sensitive > auth > photo > general。
     */
    private int determineRateLimit(String path) {
        if (isSensitiveEndpoint(path)) {
            return RateLimitConfig.getSensitiveRateLimit();
        } else if (isAuthEndpoint(path)) {
            return RateLimitConfig.getAuthRateLimit();
        } else if (isPhotoEndpoint(path)) {
            return RateLimitConfig.getPhotoRateLimit();
        } else {
            return RateLimitConfig.getGeneralRateLimit();
        }
    }

    private boolean isSensitiveEndpoint(String path) {
        return SENSITIVE_PATHS.contains(path);
    }

    /**
     * /api/v1/auth/ 以下はフォールバックで auth カテゴリ扱い。
     * Issue#95: SENSITIVE にも個別登録にも無い /api/v1/auth/* はセキュア側（10 req/分）に寄せる。
     */
    private boolean isAuthEndpoint(String path) {
        return path.startsWith(AUTH_PATH_PREFIX);
    }

    /**
     * /api/v1/photos 完全一致、または /api/v1/photos/ 配下のみを photo カテゴリとする。
     * Issue#95: startsWith("/api/v1/photos") 単独だと /api/v1/photos-sitemap 等を
     * 誤って photo カテゴリ（30 req/分）で縛ってしまうため、exact + prefix/ で分離。
     */
    private boolean isPhotoEndpoint(String path) {
        return PHOTO_PATH_EXACT.equals(path) || path.startsWith(PHOTO_PATH_PREFIX);
    }

    /**
     * ユーザー識別子を取得する。
     * 認証済みユーザーの場合は user:{email}、未認証の場合は ip:{address} を返す。
     * Issue#95: SecurityConfig で JwtAuthenticationFilter → RateLimitFilter の順に並べたため、
     * ここから SecurityContext 経由で認証情報を参照できる。
     */
    private String getUserIdentifier(HttpServletRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (isAuthenticated(authentication)) {
            return USER_PREFIX + authentication.getName();
        }
        return IP_PREFIX + extractClientIp(request);
    }

    private boolean isAuthenticated(Authentication authentication) {
        return authentication != null
                && authentication.isAuthenticated()
                && !ANONYMOUS_USER.equals(authentication.getPrincipal());
    }

    private String extractClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader(X_FORWARDED_FOR_HEADER);

        if (forwardedFor != null && !forwardedFor.isEmpty()) {
            return forwardedFor.split(",")[0].trim();
        }

        return request.getRemoteAddr();
    }

    /** テスト用: Bucket キャッシュをクリアする */
    public void clearCache() {
        bucketCache.invalidateAll();
        logger.debug("レート制限キャッシュをクリアしました");
    }

    /** テスト用: 全エントリを強制的に期限切れにする */
    public void expireAllEntries() {
        bucketCache.invalidateAll();
        bucketCache.cleanUp();
        logger.debug("レート制限キャッシュの全エントリを期限切れにしました");
    }
}
