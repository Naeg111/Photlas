package com.photlas.backend.filter;

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
import java.util.concurrent.ConcurrentHashMap;

/**
 * APIレート制限フィルター
 * Issue#22: API Rate Limiting の実装
 *
 * Token Bucketアルゴリズムを使用してエンドポイント別にレート制限を適用する
 */
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Logger logger = LoggerFactory.getLogger(RateLimitFilter.class);

    // エンドポイントパス定数
    private static final String AUTH_REGISTER_PATH = "/api/v1/auth/register";
    private static final String AUTH_LOGIN_PATH = "/api/v1/auth/login";
    private static final String PHOTO_PATH_PREFIX = "/api/v1/photos";

    // ユーザー識別子プレフィックス
    private static final String USER_PREFIX = "user:";
    private static final String IP_PREFIX = "ip:";
    private static final String ANONYMOUS_USER = "anonymousUser";

    // HTTP ヘッダー
    private static final String X_FORWARDED_FOR_HEADER = "X-Forwarded-For";
    private static final String RETRY_AFTER_HEADER = "Retry-After";
    private static final String RETRY_AFTER_SECONDS = "60";

    // レスポンスメッセージ
    private static final String RATE_LIMIT_EXCEEDED_MESSAGE = "Too many requests. Please try again later.";

    /**
     * ユーザー/IPごとのBucketを管理するキャッシュ
     * キー形式: "rate_limit:user_identifier"
     */
    private final ConcurrentHashMap<String, Bucket> bucketCache = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        String requestPath = request.getRequestURI();
        int rateLimit = determineRateLimit(requestPath);
        String userIdentifier = getUserIdentifier(request);
        String cacheKey = rateLimit + ":" + userIdentifier;

        // Bucketを取得または作成
        Bucket bucket = bucketCache.computeIfAbsent(cacheKey, k -> RateLimitConfig.createBucket(rateLimit));

        // トークンの消費を試みる
        if (bucket.tryConsume(1)) {
            // レート制限内: リクエストを通過
            filterChain.doFilter(request, response);
        } else {
            // レート制限超過: HTTP 429を返す
            handleRateLimitExceeded(response, userIdentifier, requestPath, rateLimit);
        }
    }

    /**
     * レート制限超過時のレスポンスを処理する
     *
     * @param response HTTPレスポンス
     * @param userIdentifier ユーザー識別子
     * @param requestPath リクエストパス
     * @param rateLimit レート制限
     * @throws IOException IO例外
     */
    private void handleRateLimitExceeded(HttpServletResponse response, String userIdentifier,
                                          String requestPath, int rateLimit) throws IOException {
        logger.warn("レート制限超過: user={}, path={}, limit={}/min", userIdentifier, requestPath, rateLimit);
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(RETRY_AFTER_HEADER, RETRY_AFTER_SECONDS);
        response.setContentType("text/plain;charset=UTF-8");
        response.getWriter().write(RATE_LIMIT_EXCEEDED_MESSAGE);
    }

    /**
     * リクエストパスに基づいてレート制限を決定する
     *
     * @param path リクエストパス
     * @return レート制限（リクエスト/分）
     */
    private int determineRateLimit(String path) {
        if (isAuthEndpoint(path)) {
            return RateLimitConfig.AUTH_RATE_LIMIT;
        } else if (isPhotoEndpoint(path)) {
            return RateLimitConfig.PHOTO_RATE_LIMIT;
        } else {
            return RateLimitConfig.GENERAL_RATE_LIMIT;
        }
    }

    /**
     * 認証エンドポイントかどうかを判定する
     *
     * @param path リクエストパス
     * @return 認証エンドポイントの場合true
     */
    private boolean isAuthEndpoint(String path) {
        return path.startsWith(AUTH_REGISTER_PATH) || path.startsWith(AUTH_LOGIN_PATH);
    }

    /**
     * 写真エンドポイントかどうかを判定する
     *
     * @param path リクエストパス
     * @return 写真エンドポイントの場合true
     */
    private boolean isPhotoEndpoint(String path) {
        return path.startsWith(PHOTO_PATH_PREFIX);
    }

    /**
     * ユーザー識別子を取得する
     * 認証済みユーザーの場合はユーザーID、未認証の場合はIPアドレスを返す
     *
     * @param request HTTPリクエスト
     * @return ユーザー識別子
     */
    private String getUserIdentifier(HttpServletRequest request) {
        if (isAuthenticatedUser()) {
            // 認証済みユーザー: ユーザーIDを使用
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            return USER_PREFIX + authentication.getName();
        }

        // 未認証ユーザー: IPアドレスを使用
        String clientIp = extractClientIp(request);
        return IP_PREFIX + clientIp;
    }

    /**
     * 認証済みユーザーかどうかを判定する
     *
     * @return 認証済みユーザーの場合true
     */
    private boolean isAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null
                && authentication.isAuthenticated()
                && !ANONYMOUS_USER.equals(authentication.getPrincipal());
    }

    /**
     * クライアントのIPアドレスを抽出する
     * X-Forwarded-Forヘッダーを優先し、存在しない場合はリモートアドレスを使用する
     *
     * @param request HTTPリクエスト
     * @return クライアントのIPアドレス
     */
    private String extractClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader(X_FORWARDED_FOR_HEADER);

        if (forwardedFor != null && !forwardedFor.isEmpty()) {
            // X-Forwarded-Forに複数のIPが含まれる場合、最初のIPを使用
            return forwardedFor.split(",")[0].trim();
        }

        return request.getRemoteAddr();
    }

    /**
     * テスト用: Bucketキャッシュをクリアする
     */
    public void clearCache() {
        bucketCache.clear();
        logger.debug("レート制限キャッシュをクリアしました");
    }
}
