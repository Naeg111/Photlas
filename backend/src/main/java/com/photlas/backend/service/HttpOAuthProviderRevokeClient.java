package com.photlas.backend.service;

import com.photlas.backend.entity.OAuthProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/**
 * Issue#81 Phase 4c - {@link OAuthProviderRevokeClient} のプロダクション実装。
 *
 * <p>Google / LINE の revoke エンドポイントへ HTTP POST する。タイムアウトは connect=3s / read=5s
 * （best-effort のため短め）。失敗時は例外を投げ、{@link OAuthTokenRevokeService} 側で WARN ログに落とす。
 *
 * <p>エンドポイント仕様:
 * <ul>
 *   <li>Google: {@code POST https://oauth2.googleapis.com/revoke?token={access_token}}</li>
 *   <li>LINE: {@code POST https://api.line.me/oauth2/v2.1/revoke}（form-urlencoded で
 *       access_token / client_id / client_secret を送信）</li>
 * </ul>
 */
@Component
public class HttpOAuthProviderRevokeClient implements OAuthProviderRevokeClient {

    private static final String GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
    private static final String LINE_REVOKE_URL = "https://api.line.me/oauth2/v2.1/revoke";

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(3);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(5);

    private final RestClient restClient;
    private final String lineClientId;
    private final String lineClientSecret;

    public HttpOAuthProviderRevokeClient(
            @Value("${spring.security.oauth2.client.registration.line.client-id:}") String lineClientId,
            @Value("${spring.security.oauth2.client.registration.line.client-secret:}") String lineClientSecret) {
        this.lineClientId = lineClientId;
        this.lineClientSecret = lineClientSecret;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout((int) CONNECT_TIMEOUT.toMillis());
        requestFactory.setReadTimeout((int) READ_TIMEOUT.toMillis());

        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .build();
    }

    @Override
    public void revoke(OAuthProvider provider, String accessToken) {
        switch (provider) {
            case GOOGLE -> revokeGoogle(accessToken);
            case LINE -> revokeLine(accessToken);
        }
    }

    private void revokeGoogle(String accessToken) {
        String url = UriComponentsBuilder.fromUriString(GOOGLE_REVOKE_URL)
                .queryParam("token", accessToken)
                .encode()
                .toUriString();
        restClient.post()
                .uri(url)
                .retrieve()
                .toBodilessEntity();
    }

    private void revokeLine(String accessToken) {
        String formBody = String.format(
                "access_token=%s&client_id=%s&client_secret=%s",
                urlEncode(accessToken),
                urlEncode(lineClientId),
                urlEncode(lineClientSecret));
        restClient.post()
                .uri(LINE_REVOKE_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(formBody)
                .retrieve()
                .toBodilessEntity();
    }

    private static String urlEncode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }
}
