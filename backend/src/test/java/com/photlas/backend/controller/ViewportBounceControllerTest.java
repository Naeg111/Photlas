package com.photlas.backend.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * iOS PWA 用 viewport バウンスエンドポイントのユニットテスト。
 */
class ViewportBounceControllerTest {

    private static final String FRONTEND_URL = "https://test.photlas.jp";

    private final ViewportBounceController controller = new ViewportBounceController(FRONTEND_URL);

    @Test
    @DisplayName("to パラメータ無しの場合、frontendUrl + / にリダイレクトする")
    void redirectsToRootByDefault() {
        ResponseEntity<Void> response = controller.bounce(null, new MockHttpServletRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getLocation()).isNotNull();
        assertThat(response.getHeaders().getLocation().toString()).isEqualTo(FRONTEND_URL + "/");
    }

    @Test
    @DisplayName("to=/profile の場合、frontendUrl + /profile にリダイレクトする")
    void redirectsToSpecifiedPath() {
        ResponseEntity<Void> response = controller.bounce("/profile", new MockHttpServletRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getLocation().toString()).isEqualTo(FRONTEND_URL + "/profile");
    }

    @Test
    @DisplayName("to が空文字の場合、ルートにフォールバックする")
    void emptyToFallsBackToRoot() {
        ResponseEntity<Void> response = controller.bounce("", new MockHttpServletRequest());

        assertThat(response.getHeaders().getLocation().toString()).isEqualTo(FRONTEND_URL + "/");
    }

    @Test
    @DisplayName("to が絶対 URL（http://...）の場合、オープンリダイレクト対策でルートにフォールバックする")
    void absoluteUrlInToFallsBackToRoot() {
        ResponseEntity<Void> response = controller.bounce("http://evil.example.com", new MockHttpServletRequest());

        assertThat(response.getHeaders().getLocation().toString()).isEqualTo(FRONTEND_URL + "/");
    }

    @Test
    @DisplayName("to が // で始まる protocol-relative URL の場合、ルートにフォールバックする")
    void protocolRelativeUrlFallsBackToRoot() {
        ResponseEntity<Void> response = controller.bounce("//evil.example.com", new MockHttpServletRequest());

        assertThat(response.getHeaders().getLocation().toString()).isEqualTo(FRONTEND_URL + "/");
    }

    @Test
    @DisplayName("Cache-Control: no-store ヘッダが付与される")
    void noStoreCacheControl() {
        ResponseEntity<Void> response = controller.bounce(null, new MockHttpServletRequest());

        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
    }
}
