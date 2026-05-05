package com.photlas.backend.service;

import com.photlas.backend.dto.LabelMappingResult;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Issue#119: AI 予測結果の一時保管サービス。analyzeToken（UUID）の発行・取得・削除と
 * 期限切れトークンの定期クリーンアップを担当する。
 */
@Service
public class AiPredictionCacheService {

    /**
     * AI 結果を一時保管し、analyzeToken（UUID v4 文字列）を発行する。
     *
     * @param result Rekognition の解析結果
     * @return analyzeToken。フロントが投稿時に送り返すことで AI 結果を取り出せる
     */
    public String save(LabelMappingResult result) {
        // Phase 3 Red 段階: スタブ実装
        return null;
    }

    /**
     * トークンに対応する AI 結果を取得する。期限切れ・存在しない場合は空。
     *
     * @param analyzeToken save() で発行されたトークン
     * @return 有効なトークンに対応する AI 結果、または空
     */
    public Optional<LabelMappingResult> findValid(String analyzeToken) {
        // Phase 3 Red 段階: スタブ実装
        return Optional.empty();
    }

    /**
     * トークンを削除する（投稿確定時の使い切り削除）。
     *
     * @param analyzeToken 削除対象トークン
     */
    public void delete(String analyzeToken) {
        // Phase 3 Red 段階: スタブ実装
    }

    /**
     * 期限切れトークンを一括削除する。Spring Scheduled により日次で自動実行される。
     *
     * @return 削除した行数（参考値）
     */
    public int cleanupExpired() {
        // Phase 3 Red 段階: スタブ実装
        return 0;
    }
}
