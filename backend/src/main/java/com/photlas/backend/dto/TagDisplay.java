package com.photlas.backend.dto;

/**
 * Issue#135: ユーザー言語の表示名を解決したキーワード DTO。
 *
 * <p>写真詳細・検索結果カード・キーワードランディングページ等で使う。
 * 翻訳欠落時のフォールバック（en → rekognition_label）は
 * {@link com.photlas.backend.service.TagService#pickDisplayName} で処理済み。</p>
 *
 * @param tagId       Tag.id
 * @param slug        Tag.slug
 * @param displayName ユーザー言語の表示名（フォールバック適用後）
 */
public record TagDisplay(
        Long tagId,
        String slug,
        String displayName
) {
}
