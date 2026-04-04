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
import java.time.Duration;

/**
 * APIレート制限フィルター
 * Issue#22: API Rate Limiting の実装
 *
 * Token Bucketアルゴリズムを使用してエンドポイント別にレート制限を適用する。
 * Caffeineキャッシュにより、一定時間アクセスがないエントリは自動的に削除される。
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

    /** キャッシュのTTL: 最終アクセスから10分 */
    private static final Duration CACHE_TTL = Duration.ofMinutes(10);

    /**
     * ユーザー/IPごとのBucketを管理するキャッシュ（TTL付き）
     * 最終アクセスから10分経過したエントリは自動的に削除される
     */
    private Cache<String, Bucket> bucketCache = Caffeine.newBuilder()
            .expireAfterAccess(CACHE_TTL)
            .build();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {

        String requestPath = request.getRequestURI();
        int rateLimit = determineRateLimit(requestPath);
        String userIdentifier = getUserIdentifier(request);
        String cacheKey = rateLimit + ":" + userIdentifier;

        // Bucketを取得または作成
        Bucket bucket = bucketCache.get(cacheKey, k -> RateLimitConfig.createBucket(rateLimit));

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
     */
    private int determineRateLimit(String path) {
        if (isAuthEndpoint(path)) {
            return RateLimitConfig.getAuthRateLimit();
        } else if (isPhotoEndpoint(path)) {
            return RateLimitConfig.getPhotoRateLimit();
        } else {
            return RateLimitConfig.getGeneralRateLimit();
        }
    }

    private boolean isAuthEndpoint(String path) {
        return path.startsWith(AUTH_REGISTER_PATH) || path.startsWith(AUTH_LOGIN_PATH);
    }

    private boolean isPhotoEndpoint(String path) {
        return path.startsWith(PHOTO_PATH_PREFIX);
    }

    /**
     * ユーザー識別子を取得する
     * 認証済みユーザーの場合はユーザーID、未認証の場合はIPアドレスを返す
     */
    private String getUserIdentifier(HttpServletRequest request) {
        if (isAuthenticatedUser()) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            return USER_PREFIX + authentication.getName();
        }

        String clientIp = extractClientIp(request);
        return IP_PREFIX + clientIp;
    }

    private boolean isAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
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

    /**
     * テスト用: Bucketキャッシュをクリアする
     */
    public void clearCache() {
        bucketCache.invalidateAll();
        logger.debug("レート制限キャッシュをクリアしました");
    }

    /**
     * テスト用: 全エントリを強制的に期限切れにする
     */
    public void expireAllEntries() {
        bucketCache.invalidateAll();
        bucketCache.cleanUp();
        logger.debug("レート制限キャッシュの全エントリを期限切れにしました");
    }
}
