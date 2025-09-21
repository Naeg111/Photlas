package com.photlas.backend.controller;

// Spring Boot Web関連のアノテーションインポート
import org.springframework.web.bind.annotation.GetMapping;     // HTTP GETリクエストのマッピング用
import org.springframework.web.bind.annotation.RequestMapping; // ベースURLパスの定義用
import org.springframework.web.bind.annotation.RestController;  // RESTful APIコントローラーの定義用

// Java標準ライブラリ
import java.util.Map; // Key-Value形式のデータ構造

/**
 * ヘルスチェック用コントローラー
 * Issue#1: プロジェクトセットアップと基本レイアウト - ヘルスチェックAPI実装
 * 
 * 【目的】
 * - サーバーの生存確認用エンドポイントを提供
 * - ロードバランサーやモニタリングツールからの死活監視に使用
 * - システムの基本的な稼働状況を簡易チェック
 * 
 * 【TDD実装過程】
 * Red段階: テストが失敗する状態
 * Green段階: テストを通すための最小実装（現在の状態）
 * Refactor段階: 必要に応じてコードを改善（今後の課題）
 */
@RestController                    // このクラスがRESTful APIのコントローラーであることをSpringに通知
@RequestMapping("/api/v1")         // すべてのエンドポイントに共通のベースパス '/api/v1' を設定
public class HealthController {
    
    /**
     * サーバーヘルスチェック用エンドポイント
     * 
     * 【エンドポイント詳細】
     * - URL: GET /api/v1/health
     * - 認証: 不要（パブリックエンドポイント）
     * - 用途: サーバーの生存確認、死活監視
     * 
     * 【レスポンス形式】
     * - Content-Type: application/json
     * - ボディ: {"status": "UP"}
     * - HTTPステータス: 200 OK
     * 
     * @return Map<String, String> ヘルスステータス情報
     *         - key "status": サーバーの状態を表す文字列
     *         - value "UP": 正常稼働中を示す
     */
    @GetMapping("/health")             // HTTP GETリクエストを '/health' パスにマッピング
    public Map<String, String> health() {
        // Java 9以降のMap.of()メソッドを使用してイミューダブルなMapを生成
        // 従来のCollections.singletonMap()より簡潔で読みやすい
        // Spring Bootが自動的にJSONシリアライゼーションを行い、レスポンスとして返却
        return Map.of("status", "UP");
    }
}
