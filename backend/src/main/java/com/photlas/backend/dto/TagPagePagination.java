package com.photlas.backend.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * Issue#136 Phase 5: 省略付きページ番号 (Q8 / §4.9) を表現するページネーション情報。
 *
 * <p>{@code displayPages} は表示するページ番号を順番に並べたリスト。
 * 省略 ("…") は {@code 0} で表現する（ページ番号は 1 以上のため安全に区別可能）。</p>
 *
 * <p>テンプレート側は {@code displayPages} を反復し、{@code 0} なら「…」を、
 * それ以外ならページリンクを描画する。</p>
 *
 * @param current      現在ページ番号 (1-indexed)
 * @param total        総ページ数 (最低 1)
 * @param hasPrev      「前へ」ボタンを表示すべきか
 * @param hasNext      「次へ」ボタンを表示すべきか
 * @param displayPages 表示ページ番号リスト（{@code 0} = 省略マーカー）
 */
public record TagPagePagination(
        int current,
        int total,
        boolean hasPrev,
        boolean hasNext,
        List<Integer> displayPages
) {

    /** {@code displayPages} に格納される省略マーカー値。 */
    public static final int ELLIPSIS = 0;

    /**
     * §4.9 のアルゴリズムに従い {@code displayPages} を組み立てる。
     */
    public static TagPagePagination of(int current, int total) {
        int safeTotal = Math.max(1, total);
        int safeCurrent = Math.min(Math.max(1, current), safeTotal);
        return new TagPagePagination(
                safeCurrent,
                safeTotal,
                safeCurrent > 1,
                safeCurrent < safeTotal,
                calcDisplayPages(safeCurrent, safeTotal));
    }

    /** §4.9 の純粋関数。current/total は事前にクリップ済みの前提。 */
    static List<Integer> calcDisplayPages(int current, int total) {
        List<Integer> pages = new ArrayList<>();
        if (total <= 7) {
            for (int i = 1; i <= total; i++) pages.add(i);
            return pages;
        }
        if (current <= 4) {
            pages.add(1); pages.add(2); pages.add(3); pages.add(4); pages.add(5);
            pages.add(ELLIPSIS); pages.add(total);
            return pages;
        }
        if (current >= total - 3) {
            pages.add(1); pages.add(ELLIPSIS);
            for (int i = total - 4; i <= total; i++) pages.add(i);
            return pages;
        }
        pages.add(1); pages.add(ELLIPSIS);
        pages.add(current - 1); pages.add(current); pages.add(current + 1);
        pages.add(ELLIPSIS); pages.add(total);
        return pages;
    }
}
