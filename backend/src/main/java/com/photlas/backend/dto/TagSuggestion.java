package com.photlas.backend.dto;

/**
 * Issue#135: Rekognition ラベルから抽出された AI 提案キーワード。
 *
 * <p>{@code PhotoAnalyzeResponse.suggestedTags} の要素として
 * フロントエンドに返却され、投稿フォームのキーワードプリフィルに使われる。</p>
 *
 * @param tagId       Tag.id
 * @param slug        Tag.slug
 * @param displayName ユーザー言語の表示名
 * @param confidence  Rekognition 信頼度（0〜100）
 */
public record TagSuggestion(
        Long tagId,
        String slug,
        String displayName,
        Float confidence
) {
}
