package com.photlas.backend.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * API ホスト（api.photlas.jp / test-api.photlas.jp）の /robots.txt を返すコントローラー。
 *
 * <p>API ドメインは ALB → Spring Boot 直結で、フロントエンドの nginx を経由しない。
 * そのため robots.txt も Spring Boot 自身で配信する必要がある。
 * 全パスをクロール拒否することで、Google 等の検索エンジンが API ドメインをインデックスしないようにする
 * （X-Robots-Tag ヘッダによる noindex 指定とあわせて多層防御）。</p>
 */
@RestController
public class RobotsTxtController {

    private static final String DISALLOW_ALL = "User-agent: *\nDisallow: /\n";

    @GetMapping(value = "/robots.txt", produces = MediaType.TEXT_PLAIN_VALUE)
    public String robotsTxt() {
        return DISALLOW_ALL;
    }
}
