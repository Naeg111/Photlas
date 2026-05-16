package com.photlas.backend.dto;

/**
 * Issue#132 3.4.1: 親ラベル経由でカテゴリマッピングが成立した時のイベント。
 *
 * <p>GA4 アナリティクスイベント {@code ai_parent_fallback_used} のパラメータとして
 * フロントエンドへ返却され、フロントが GA4 へ送信する。</p>
 *
 * <p>1 つの子ラベルが複数カテゴリへマッピングされる場合（例: 親 Sparrow → 207 + 208）は、
 * カテゴリごとに別イベントとして記録される。</p>
 *
 * @param childLabel    辞書未マッチだった子ラベル名（例: "Husky"）
 * @param parentLabel   親フォールバックで採用された親ラベル名（例: "Dog"）
 * @param categoryCode  マッピング先 Photlas カテゴリコード（例: 207）
 */
public record ParentFallback(
        String childLabel,
        String parentLabel,
        int categoryCode
) {
}
