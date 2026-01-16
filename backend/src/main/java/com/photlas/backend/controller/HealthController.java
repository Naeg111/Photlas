package com.photlas.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * ヘルスチェック用コントローラー
 * Issue#1: プロジェクトセットアップと基本レイアウト
 *
 * サーバーの生存確認用エンドポイントを提供します。
 * ロードバランサーやモニタリングツールからの死活監視に使用されます。
 */
@RestController
@RequestMapping("/api/v1")
public class HealthController {

    /**
     * サーバーヘルスチェック用エンドポイント
     *
     * @return ヘルスステータス（{"status": "UP"}）
     */
    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
