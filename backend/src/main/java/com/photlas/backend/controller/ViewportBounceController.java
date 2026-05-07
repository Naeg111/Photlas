package com.photlas.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * iOS PWA viewport 修復用のバウンスエンドポイント（案 T 改）。
 *
 * <p>iOS PWA で OAuth ログイン後に画面下部 / 上部の safe area が乱れる事象への対策。
 * Google OAuth では「外部ドメイン → 戻る」遷移で iOS が viewport を再計算するが、
 * LINE OAuth ではこの効果が得られない。
 * このエンドポイントは {@code test-api.photlas.jp}（フロントエンドの
 * {@code test.photlas.jp} とは別オリジン）に存在し、HTML レスポンスとして
 * meta refresh で 1.5 秒後にフロントエンドへ戻る。即時 302 では SFSafariViewController が
 * 開いた瞬間に閉じてしまい iOS の viewport 再計算がトリガーされない可能性があるため、
 * 滞在時間を確保する設計とした。
 *
 * <p>フロントエンドは OAuth 完了後 PWA standalone モードのとき、ここに navigate する。
 * iOS は外部ドメインを検知して SFSafariViewController を起動 →
 * 1.5 秒間「ログイン処理中…」を表示 → meta refresh で test.photlas.jp/ に redirect →
 * iOS が PWA scope 復帰検知 → SFSafariViewController が自動 close →
 * iOS が viewport を再計算する、という流れを期待する。
 *
 * <p>SecurityConfig の {@code AUTH_ENDPOINT_PATTERN = "/api/v1/auth/**"} に含まれるため
 * 認証なしでアクセス可能。OAuth2SecurityConfig は {@code /api/v1/auth/oauth2/**} のみ
 * 対象なので、本エンドポイントは通常の SecurityConfig のフィルタチェインで処理される。
 */
@RestController
@RequestMapping("/api/v1/auth")
public class ViewportBounceController {

    /** SFSafariViewController が「開いた」と iOS が認識する時間を確保する待機秒数 */
    private static final String META_REFRESH_DELAY_SECONDS = "1.5";

    private final String frontendUrl;

    public ViewportBounceController(@Value("${app.frontend-url:https://photlas.jp}") String frontendUrl) {
        this.frontendUrl = frontendUrl;
    }

    /**
     * HTML レスポンスを返し、meta refresh で 1.5 秒後にフロントエンドへリダイレクトする。
     *
     * @param to オプション: 戻り先のフロントエンドパス（既定値 "/"）。
     *           空文字や絶対URL指定は無視され、"/" にフォールバックする
     *           （オープンリダイレクト脆弱性回避）
     * @return 200 OK with HTML（meta refresh 含む）
     */
    @GetMapping(value = "/viewport-bounce", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> bounce(
            @RequestParam(name = "to", required = false) String to) {
        String safePath = sanitizePath(to);
        String redirectUrl = frontendUrl + safePath;
        String html = buildHtml(redirectUrl);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_HTML);
        headers.setCacheControl("no-store");
        return new ResponseEntity<>(html, headers, HttpStatus.OK);
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

    /**
     * 「ログイン処理中…」を 1.5 秒間表示してから meta refresh で redirectUrl に遷移する HTML を生成する。
     * URL は HTML 属性に埋め込むため XSS 対策で最小限のエスケープを行う。
     */
    private static String buildHtml(String redirectUrl) {
        String escaped = htmlAttributeEscape(redirectUrl);
        return "<!DOCTYPE html>"
                + "<html lang=\"ja\">"
                + "<head>"
                + "<meta charset=\"UTF-8\" />"
                + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, viewport-fit=cover\" />"
                + "<meta http-equiv=\"refresh\" content=\"" + META_REFRESH_DELAY_SECONDS + "; url=" + escaped + "\" />"
                + "<title>ログイン処理中…</title>"
                + "<style>"
                + "html,body{margin:0;padding:0;background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;}"
                + "body{display:flex;align-items:center;justify-content:center;min-height:100vh;font-size:14px;}"
                + "</style>"
                + "</head>"
                + "<body><p>ログイン処理中…</p></body>"
                + "</html>";
    }

    /** HTML 属性に値を埋め込む際の最小エスケープ（&, <, >, ", '）。 */
    private static String htmlAttributeEscape(String s) {
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
