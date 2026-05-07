package com.photlas.backend.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.Optional;

/**
 * iOS PWA viewport 修復用のバウンスエンドポイント。
 *
 * <p>iOS PWA で OAuth ログイン後に画面下部 / 上部の safe area が乱れる事象への対策。
 * Google OAuth では「外部ドメイン → 戻る」の遷移で iOS が viewport を再計算して
 * 状態がリセットされるが、LINE OAuth ではこの効果が得られない。
 * このエンドポイントは {@code test-api.photlas.jp}（フロントエンドの
 * {@code test.photlas.jp} とは別オリジン）に存在し、即時に 302 で
 * フロントエンドへ戻すだけのエンドポイント。
 *
 * <p>フロントエンドは OAuth 完了後 PWA standalone モードのとき、ここに navigate する。
 * iOS は外部ドメインを検知して SFSafariViewController を起動 →
 * 即 302 でフロントエンドスコープに戻る → SFSafariViewController が自動 close →
 * iOS が viewport を再計算する、という流れを期待する。
 *
 * <p>SecurityConfig の {@code AUTH_ENDPOINT_PATTERN = "/api/v1/auth/**"} に含まれるため
 * 認証なしでアクセス可能。OAuth2SecurityConfig は {@code /api/v1/auth/oauth2/**} のみ
 * 対象なので、本エンドポイントは通常の SecurityConfig のフィルタチェインで処理される。
 */
@RestController
@RequestMapping("/api/v1/auth")
public class ViewportBounceController {

    private final String frontendUrl;

    public ViewportBounceController(@Value("${app.frontend-url:https://photlas.jp}") String frontendUrl) {
        this.frontendUrl = frontendUrl;
    }

    /**
     * フロントエンドへ即時 302 リダイレクトする。
     *
     * @param to オプション: 戻り先のフロントエンドパス（既定値 "/"）。
     *           空文字や絶対URL指定は無視され、"/" にフォールバックする
     *           （オープンリダイレクト脆弱性回避）
     * @return 302 redirect to {frontendUrl}{to}
     */
    @GetMapping("/viewport-bounce")
    public ResponseEntity<Void> bounce(
            @RequestParam(name = "to", required = false) String to,
            HttpServletRequest request) {
        String safePath = sanitizePath(to);
        URI location = URI.create(frontendUrl + safePath);
        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(location);
        // キャッシュ無効化（毎回 302 を返すため）
        headers.setCacheControl("no-store");
        return new ResponseEntity<>(headers, HttpStatus.FOUND);
    }

    /**
     * リダイレクト先のパスをサニタイズする。
     * 安全なフロントエンド内相対パスのみを許可し、それ以外は "/" にフォールバックする。
     */
    private static String sanitizePath(String to) {
        return Optional.ofNullable(to)
                .filter(p -> !p.isBlank())
                .filter(p -> p.startsWith("/"))
                // "//foo" / "/\\foo" 形式の protocol-relative URL を排除（オープンリダイレクト対策）
                .filter(p -> !p.startsWith("//") && !p.startsWith("/\\"))
                .orElse("/");
    }
}
