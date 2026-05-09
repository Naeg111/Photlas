package com.photlas.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Issue#127: パスごとに Cache-Control を出し分ける Servlet Filter。
 *
 * <p>対象 8 系統の公開 GET / HEAD エンドポイントは
 * {@code Cache-Control: public, max-age=<TTL>} を返し、それ以外は従来の
 * Spring Security デフォルトに任せる。これにより CloudFront `/api/*` Behavior
 * （{@code Managed-CachingOptimized}）と組み合わせて対象 API のみを CDN キャッシュ
 * 可能化する。</p>
 *
 * <p>登録方法（{@code SecurityConfig}）:</p>
 * <pre>{@code
 * http.addFilterAfter(new ConditionalCacheControlHeaderWriter(), HeaderWriterFilter.class);
 * }</pre>
 *
 * <p>{@code HeaderWriterFilter} の直後に挿入することが必須。これにより
 * {@code HeaderWriterFilter} が wrap した response を共有でき、forward direction で
 * 本 Filter が設定した値を default {@code CacheControlHeadersWriter} が
 * {@code containsHeader} チェックでスキップする構造になる。</p>
 *
 * <p>動作:</p>
 * <ol>
 *   <li>{@code HeaderWriterFilter} が response を wrap して chain を進める。</li>
 *   <li>本 Filter の forward direction: 対象パスなら
 *       {@code Cache-Control} / {@code Pragma}（空）/ {@code Expires}（空）を
 *       wrap された response にセット。chain.doFilter で controller まで進む。</li>
 *   <li>{@code HeaderWriterFilter} の finally で default writers が走り、
 *       既にセット済みのヘッダはスキップ。</li>
 * </ol>
 *
 * <p>注: chain.doFilter から戻った時点では response が既に commit されており
 * {@code setHeader} が no-op になるため、forward direction でセットする必要がある
 * （実機検証で判明）。これにより 4xx / 5xx エラーレスポンスでも対象パスなら
 * Cache-Control: max-age=N が返るが、CloudFront は 4xx / 5xx に対して
 * {@code ErrorCachingMinTTL}（デフォルト 10s）でキャッシュするため CDN 側の
 * 実害は最小限で、許容範囲。</p>
 *
 * <p>controller が後続の処理で Cache-Control を独自に上書きする場合
 * （{@code ViewportBounceController} の {@code no-store} 等）は controller の
 * 設定が後勝ちで尊重される（setHeader は replace 仕様）。</p>
 */
public class ConditionalCacheControlHeaderWriter extends OncePerRequestFilter {

    /**
     * 対象パスごとに TTL（秒）を持たせるためのレコード。
     * 先頭から評価し最初にマッチしたものを採用する。
     *
     * <p>マッチング: GET / HEAD メソッド限定で、URL の path 部分を {@code Pattern} で
     * フル一致確認する。Spring Security の AntPathRequestMatcher /
     * RegexRequestMatcher はバージョン依存の挙動があるため、ここでは標準 java.util.regex
     * のみを使う。</p>
     */
    private record CacheableRule(Pattern pathPattern, int maxAgeSeconds) {}

    // 各パスを Pattern で表現する（フル一致）。
    // \d+ で数字のみマッチさせることで、/api/v1/users/me（個人情報のためキャッシュ不可）
    // を意図的に除外する。
    private static final List<CacheableRule> CACHEABLE_RULES = List.of(
            new CacheableRule(Pattern.compile("/api/v1/spots"), 60),
            new CacheableRule(Pattern.compile("/api/v1/categories"), 300),
            new CacheableRule(Pattern.compile("/api/v1/ogp/photo/[^/]+"), 300),
            new CacheableRule(Pattern.compile("/api/v1/sitemap\\.xml"), 3600),
            new CacheableRule(Pattern.compile("/api/v1/sitemap-static\\.xml"), 3600),
            new CacheableRule(Pattern.compile("/api/v1/sitemap-photos-[^/]+\\.xml"), 3600),
            new CacheableRule(Pattern.compile("/api/v1/users/\\d+"), 60),
            new CacheableRule(Pattern.compile("/api/v1/users/\\d+/photos"), 60)
    );

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        // GET / HEAD のみキャッシュ対象（CloudFront も GET / HEAD のみキャッシュする）。
        // forward direction でセットすることで、後続の Spring Security default writer が
        // containsHeader チェックで上書きをスキップする。
        String method = req.getMethod();
        if ("GET".equals(method) || "HEAD".equals(method)) {
            String path = req.getRequestURI();
            Optional<CacheableRule> matched = CACHEABLE_RULES.stream()
                    .filter(rule -> rule.pathPattern().matcher(path).matches())
                    .findFirst();

            if (matched.isPresent()) {
                res.setHeader(HttpHeaders.CACHE_CONTROL,
                        "public, max-age=" + matched.get().maxAgeSeconds());
                // CloudFront は Pragma: no-cache 残存時にキャッシュをスキップするため
                // 空文字で先にセットしておき、default writer の上書きを抑止する
                res.setHeader(HttpHeaders.PRAGMA, "");
                res.setHeader(HttpHeaders.EXPIRES, "");
            }
        }

        chain.doFilter(req, res);
    }
}
