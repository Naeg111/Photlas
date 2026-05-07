package com.photlas.backend.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * iOS PWA 用 viewport バウンスエンドポイントのユニットテスト。
 */
class ViewportBounceControllerTest {

    private static final String FRONTEND_URL = "https://test.photlas.jp";

    private final ViewportBounceController controller = new ViewportBounceController(FRONTEND_URL);

    @Test
    @DisplayName("to パラメータ無しの場合、frontendUrl + / への meta refresh を含む HTML を返す")
    void redirectsToRootByDefault() {
        ResponseEntity<String> response = controller.bounce(null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getContentType().toString()).startsWith(MediaType.TEXT_HTML_VALUE);
        assertThat(response.getBody()).contains("http-equiv=\"refresh\"");
        assertThat(response.getBody()).contains("url=" + FRONTEND_URL + "/");
    }

    @Test
    @DisplayName("to=/profile の場合、frontendUrl + /profile への meta refresh を含む")
    void redirectsToSpecifiedPath() {
        ResponseEntity<String> response = controller.bounce("/profile");

        assertThat(response.getBody()).contains("url=" + FRONTEND_URL + "/profile");
    }

    @Test
    @DisplayName("to が空文字の場合、ルートにフォールバックする")
    void emptyToFallsBackToRoot() {
        ResponseEntity<String> response = controller.bounce("");

        assertThat(response.getBody()).contains("url=" + FRONTEND_URL + "/");
    }

    @Test
    @DisplayName("to が絶対 URL（http://...）の場合、オープンリダイレクト対策でルートにフォールバックする")
    void absoluteUrlInToFallsBackToRoot() {
        ResponseEntity<String> response = controller.bounce("http://evil.example.com");

        // 攻撃者の URL は出現せず、frontendUrl + / にリダイレクトされる
        assertThat(response.getBody()).doesNotContain("evil.example.com");
        assertThat(response.getBody()).contains("url=" + FRONTEND_URL + "/");
    }

    @Test
    @DisplayName("to が // で始まる protocol-relative URL の場合、ルートにフォールバックする")
    void protocolRelativeUrlFallsBackToRoot() {
        ResponseEntity<String> response = controller.bounce("//evil.example.com");

        assertThat(response.getBody()).doesNotContain("evil.example.com");
        assertThat(response.getBody()).contains("url=" + FRONTEND_URL + "/");
    }

    @Test
    @DisplayName("Cache-Control: no-store ヘッダが付与される")
    void noStoreCacheControl() {
        ResponseEntity<String> response = controller.bounce(null);

        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
    }

    @Test
    @DisplayName("HTML には『ログイン処理中…』のメッセージが含まれる")
    void htmlContainsLoadingMessage() {
        ResponseEntity<String> response = controller.bounce(null);

        assertThat(response.getBody()).contains("ログイン処理中");
    }

    @Test
    @DisplayName("meta refresh の遅延時間は 1.5 秒")
    void metaRefreshDelay() {
        ResponseEntity<String> response = controller.bounce(null);

        assertThat(response.getBody()).contains("content=\"1.5;");
    }
}
