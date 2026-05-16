package com.photlas.backend.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Issue#136 §4.9: 省略付きページ番号アルゴリズムの単体テスト。
 *
 * <p>{@code 0} は省略マーカー (ELLIPSIS) を表す。</p>
 *
 * <p>仕様表（Issue#136 §4.9）に従う:</p>
 * <pre>
 * | total | current | 期待出力 |
 * |-------|---------|---------|
 * | 1     | 1       | [1] |
 * | 5     | 3       | [1, 2, 3, 4, 5] |
 * | 7     | 4       | [1, 2, 3, 4, 5, 6, 7] |
 * | 10    | 1       | [1, 2, 3, 4, 5, …, 10] |
 * | 10    | 5       | [1, …, 4, 5, 6, …, 10] |
 * | 10    | 10      | [1, …, 6, 7, 8, 9, 10] |
 * | 100   | 50      | [1, …, 49, 50, 51, …, 100] |
 * </pre>
 */
class TagPagePaginationTest {

    private static final int E = TagPagePagination.ELLIPSIS;

    @Test
    @DisplayName("Issue#136 §4.9 - total=1 current=1 → [1]")
    void singlePage() {
        assertThat(TagPagePagination.calcDisplayPages(1, 1)).containsExactly(1);
    }

    @Test
    @DisplayName("Issue#136 §4.9 - total=5 current=3 → 全部出す")
    void smallTotal_allShown() {
        assertThat(TagPagePagination.calcDisplayPages(3, 5)).containsExactly(1, 2, 3, 4, 5);
    }

    @Test
    @DisplayName("Issue#136 §4.9 - total=7 current=4 → 7 まで全部出す（境界）")
    void boundaryTotalSeven() {
        assertThat(TagPagePagination.calcDisplayPages(4, 7)).containsExactly(1, 2, 3, 4, 5, 6, 7);
    }

    @Test
    @DisplayName("Issue#136 §4.9 - total=10 current=1 → 序盤 [1,2,3,4,5,…,10]")
    void earlyPages() {
        assertThat(TagPagePagination.calcDisplayPages(1, 10)).containsExactly(1, 2, 3, 4, 5, E, 10);
    }

    @Test
    @DisplayName("Issue#136 §4.9 - total=10 current=5 → 中盤 [1,…,4,5,6,…,10]")
    void middlePages() {
        assertThat(TagPagePagination.calcDisplayPages(5, 10)).containsExactly(1, E, 4, 5, 6, E, 10);
    }

    @Test
    @DisplayName("Issue#136 §4.9 - total=10 current=10 → 終盤 [1,…,6,7,8,9,10]")
    void latePages() {
        assertThat(TagPagePagination.calcDisplayPages(10, 10)).containsExactly(1, E, 6, 7, 8, 9, 10);
    }

    @Test
    @DisplayName("Issue#136 §4.9 - total=100 current=50 → 中盤大規模 [1,…,49,50,51,…,100]")
    void largeMiddlePages() {
        assertThat(TagPagePagination.calcDisplayPages(50, 100))
                .containsExactly(1, E, 49, 50, 51, E, 100);
    }

    @Test
    @DisplayName("Issue#136 - of() で hasPrev/hasNext が境界で正しく決まる")
    void prevNextBoundaries() {
        TagPagePagination p1 = TagPagePagination.of(1, 5);
        assertThat(p1.hasPrev()).isFalse();
        assertThat(p1.hasNext()).isTrue();

        TagPagePagination p3 = TagPagePagination.of(3, 5);
        assertThat(p3.hasPrev()).isTrue();
        assertThat(p3.hasNext()).isTrue();

        TagPagePagination p5 = TagPagePagination.of(5, 5);
        assertThat(p5.hasPrev()).isTrue();
        assertThat(p5.hasNext()).isFalse();
    }

    @Test
    @DisplayName("Issue#136 - of() は範囲外 current を自動クリップ")
    void clipsOutOfRange() {
        TagPagePagination outOfRange = TagPagePagination.of(99, 3);
        assertThat(outOfRange.current()).isEqualTo(3);
        assertThat(outOfRange.total()).isEqualTo(3);

        TagPagePagination negative = TagPagePagination.of(-5, 3);
        assertThat(negative.current()).isEqualTo(1);

        TagPagePagination zeroTotal = TagPagePagination.of(1, 0);
        assertThat(zeroTotal.total()).isEqualTo(1);
        assertThat(zeroTotal.current()).isEqualTo(1);
        assertThat((List<Integer>) zeroTotal.displayPages()).containsExactly(1);
    }
}
