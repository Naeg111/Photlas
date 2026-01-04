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

    /**
     * Retry-Afterヘッダーの値（秒）
     */
    private static final String RETRY_AFTER_SECONDS = "60";

    /**
     * ユーザー/IPごとのBucketを管理するキャッシュ
     * キー形式: "endpoint_type:user_identifier"
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
            logger.warn("レート制限超過: user={}, path={}, limit={}/min", userIdentifier, requestPath, rateLimit);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", RETRY_AFTER_SECONDS);
            response.getWriter().write("Too many requests. Please try again later.");
        }
    }

    /**
     * リクエストパスに基づいてレート制限を決定する
     *
     * @param path リクエストパス
     * @return レート制限（リクエスト/分）
     */
    private int determineRateLimit(String path) {
        if (path.startsWith("/api/v1/users/register") || path.startsWith("/api/v1/users/login")) {
            return RateLimitConfig.AUTH_RATE_LIMIT;
        } else if (path.startsWith("/api/v1/photos")) {
            return RateLimitConfig.PHOTO_RATE_LIMIT;
        } else {
            return RateLimitConfig.GENERAL_RATE_LIMIT;
        }
    }

    /**
     * ユーザー識別子を取得する
     * 認証済みユーザーの場合はユーザーID、未認証の場合はIPアドレスを返す
     *
     * @param request HTTPリクエスト
     * @return ユーザー識別子
     */
    private String getUserIdentifier(HttpServletRequest request) {
        // 認証情報を確認
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()
                && !"anonymousUser".equals(authentication.getPrincipal())) {
            // 認証済みユーザー: ユーザーIDを使用
            return "user:" + authentication.getName();
        }

        // 未認証ユーザー: IPアドレスを使用
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty()) {
            ip = request.getRemoteAddr();
        } else {
            // X-Forwarded-Forに複数のIPが含まれる場合、最初のIPを使用
            ip = ip.split(",")[0].trim();
        }
        return "ip:" + ip;
    }

    /**
     * テスト用: Bucketキャッシュをクリアする
     */
    public void clearCache() {
        bucketCache.clear();
        logger.debug("レート制限キャッシュをクリアしました");
    }
}
