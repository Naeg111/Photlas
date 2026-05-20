package com.photlas.backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Issue#58 §6: SPA の現行 {@code index.html} を取得して提供する。
 *
 * <p>{@link com.photlas.backend.controller.PhotoViewerController} が
 * {@code /photo-viewer/{id}} で「index.html ＋ 写真個別 OGP 差し込み」を返すために使う。</p>
 *
 * <p>取得元は公開 URL {@code {app.frontend-url}/index.html}（CloudFront→S3）。
 * 短期キャッシュ（{@value #TTL_MS}ms）し、取得失敗時は最後に成功した内容を返す（staleness 緩和）。
 * S3 から直接取得する案より IAM 変更不要で簡素。`s3 sync --delete` 直後の極短時間に
 * 古い JS を指す可能性はあるが、リクエスト毎ではなく短期キャッシュで影響を限定する。</p>
 */
@Service
public class IndexHtmlProvider {

    private static final Logger logger = LoggerFactory.getLogger(IndexHtmlProvider.class);

    /** index.html のキャッシュ有効期間（ミリ秒）。 */
    private static final long TTL_MS = 60_000L;

    private final String indexHtmlUrl;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private volatile String cached;
    private volatile long cachedAt;

    public IndexHtmlProvider(@Value("${app.frontend-url}") String frontendUrl) {
        this.indexHtmlUrl = frontendUrl + "/index.html";
    }

    /**
     * 現行 index.html を返す。キャッシュが新しければそれを、古ければ再取得する。
     * 取得失敗時は最後に成功したキャッシュ（無ければ null）を返す。
     */
    public String fetch() {
        long now = System.currentTimeMillis();
        String current = cached;
        if (current != null && now - cachedAt < TTL_MS) {
            return current;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(indexHtmlUrl))
                    .timeout(Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                cached = response.body();
                cachedAt = now;
                return cached;
            }
            logger.warn("index.html 取得が非 200: status={} url={}", response.statusCode(), indexHtmlUrl);
        } catch (Exception e) {
            logger.warn("index.html 取得に失敗（古いキャッシュにフォールバック）: {}", e.toString());
        }
        return cached;
    }
}
