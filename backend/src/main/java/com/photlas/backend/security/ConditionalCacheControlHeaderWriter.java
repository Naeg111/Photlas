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
 * <p>対象 8 系統の公開 GET エンドポイントは {@code Cache-Control: public, max-age=<TTL>}
 * を返し、それ以外は従来の Spring Security デフォルトに任せる。これにより
 * CloudFront `/api/*` Behavior（{@code Managed-CachingOptimized}）と組み合わせて
 * 対象 API のみを CDN キャッシュ可能化する。</p>
 *
 * <p>登録方法（{@code SecurityConfig}）:</p>
 * <pre>{@code
 * http.addFilterAfter(new ConditionalCacheControlHeaderWriter(), HeaderWriterFilter.class);
 * }</pre>
 *
 * <p>{@code HeaderWriterFilter} の直後に挿入することが必須。これにより
 * {@code HeaderWriterFilter} が wrap した response を共有でき、その finally で
 * 走る default {@code CacheControlHeadersWriter} が containsHeader をチェックして
 * 本 Filter の上書きをスキップする（既に値がセットされているため）構造になる。</p>
 *
 * <p>通常の servlet filter として（Spring Security チェーン外で）登録すると、
 * chain.doFilter から戻った時点では response が既に commit されており setHeader が
 * no-op になるため、Spring Security チェーン内に挿入する必要がある。</p>
 *
 * <p>動作:</p>
 * <ol>
 *   <li>{@code HeaderWriterFilter} が response を wrap して chain を進める。</li>
 *   <li>本 Filter が forward 走行（何もしない）→ chain.doFilter で controller まで進む。</li>
 *   <li>controller が return → chain が戻り → 本 Filter の after-chain で
 *       対象パスなら Cache-Control / Pragma / Expires を上書き。</li>
 *   <li>{@code HeaderWriterFilter.finally} で default writers が走り、
 *       既にセット済みのヘッダはスキップ。</li>
 * </ol>
 *
 * <p>controller が {@code ResponseEntity.cacheControl(...)} で独自に Cache-Control を
 * 設定済みの場合（{@code ViewportBounceController} の {@code no-store} 等）は
 * 「default 固定文字列以外」と判定して上書きを抑止する。</p>
 */
public class ConditionalCacheControlHeaderWriter extends OncePerRequestFilter {

    /**
     * 対象パスごとに TTL（秒）を持たせるためのレコード。
     * 先頭から評価し最初にマッチしたものを採用する。
     *
     * <p>マッチング: GET メソッド限定で、URL の path 部分を {@code Pattern} で
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
        chain.doFilter(req, res);

        // chain 完了後の上書き判定。
        // 4xx/5xx エラー、GET 以外、対象外パスはすべてスキップして
        // Spring Security デフォルトの no-cache をそのまま返す。
        if (!isStatus2xx(res.getStatus()) || !"GET".equals(req.getMethod())) {
            return;
        }

        String path = req.getRequestURI();
        Optional<CacheableRule> matched = CACHEABLE_RULES.stream()
                .filter(rule -> rule.pathPattern().matcher(path).matches())
                .findFirst();

        if (matched.isPresent() && !isControllerSetCacheControl(res)) {
            res.setHeader(HttpHeaders.CACHE_CONTROL,
                    "public, max-age=" + matched.get().maxAgeSeconds());
            // CloudFront は Pragma: no-cache 残存時にキャッシュをスキップするため空文字で上書き
            res.setHeader(HttpHeaders.PRAGMA, "");
            res.setHeader(HttpHeaders.EXPIRES, "");
        }
    }

    /**
     * controller が独自に Cache-Control を設定したかどうかを判定する。
     *
     * <p>Spring Security の default {@code CacheControlHeadersWriter} は no-cache
     * 系の固定文字列をセットするため、それ以外の値が入っていれば「controller 由来」と
     * 判定する。具体的には {@code ViewportBounceController} の {@code no-store}
     * や {@code DataExportController} の {@code no-store} を尊重する目的。</p>
     */
    private static boolean isControllerSetCacheControl(HttpServletResponse res) {
        String cacheControl = res.getHeader(HttpHeaders.CACHE_CONTROL);
        if (cacheControl == null) {
            return false;
        }
        return !cacheControl.equals("no-cache, no-store, max-age=0, must-revalidate");
    }

    private static boolean isStatus2xx(int status) {
        return status >= 200 && status < 300;
    }
}
