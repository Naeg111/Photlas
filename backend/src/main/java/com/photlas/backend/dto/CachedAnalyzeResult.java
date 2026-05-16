package com.photlas.backend.dto;

import java.util.List;

/**
 * Issue#136 §4.4: AI 予測キャッシュに保存する全体構造。
 *
 * <p>従来は {@link LabelMappingResult} 単体を JSON 化していたが、
 * {@code ai_confidence} を投稿時に補完するため AI 提案キーワード ({@link TagSuggestion}) も
 * 同じトークンで取得できるよう拡張した。</p>
 *
 * <p>後方互換 (Q11): {@code AiPredictionCacheService.findValid} は旧形式
 * （{@code labelMapping} キーを含まない単体 JSON）を読み込むと
 * {@code suggestedTags=空リスト} で復元する。</p>
 *
 * @param labelMapping  カテゴリ・天候マッピング結果
 * @param suggestedTags AI 提案キーワード（信頼度付き）。空リスト可
 */
public record CachedAnalyzeResult(
        LabelMappingResult labelMapping,
        List<TagSuggestion> suggestedTags
) {
}
