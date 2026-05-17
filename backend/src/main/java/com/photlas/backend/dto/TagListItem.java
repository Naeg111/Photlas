package com.photlas.backend.dto;

import java.util.List;

/**
 * Issue#135 + Issue#141 後追い: {@code GET /api/v1/tags} レスポンスの 1 タグ。
 *
 * <p>フロントは KeywordSection で受け取り、カテゴリ別に局所的にグルーピングしたり
 * 検索 BOX でリアルタイム絞り込みする。</p>
 *
 * @param tagId         Tag.id
 * @param slug          Tag.slug
 * @param displayName   ユーザー言語の表示名（フォールバック適用後）
 * @param categoryCodes 紐づくカテゴリコード（200番台、多対多なので複数）
 * @param sortOrder     表示順
 * @param photoCount    Issue#141 後追い: 該当タグの PUBLISHED + 退会済除外フィルタ済写真数。
 *                      フィルタ画面で 0 件チップを非活性表示するために使う。
 */
public record TagListItem(
        Long tagId,
        String slug,
        String displayName,
        List<Integer> categoryCodes,
        Integer sortOrder,
        Long photoCount
) {
}
