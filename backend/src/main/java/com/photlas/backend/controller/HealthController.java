package com.photlas.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * ヘルスチェック用コントローラー
 * Issue#1: 基本レイアウトとヘルスチェックAPI
 * 
 * TDD Green段階: テストを通すための最小実装
 */
@RestController
@RequestMapping("/api/v1")
public class HealthController {
    
    /**
     * ヘルスチェックエンドポイント
     * @return ステータス情報
     */
    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP");
    }
}
