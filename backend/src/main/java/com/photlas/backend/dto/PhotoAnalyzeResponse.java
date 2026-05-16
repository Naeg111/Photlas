package com.photlas.backend.dto;

import java.util.List;
import java.util.Map;

/**
 * Issue#119: {@code POST /api/v1/photos/analyze} のレスポンス DTO。
 *
 * <p>AI 解析が成功した場合: 推定カテゴリ・天候・信頼度に加え、analyzeToken を返す。
 * フロントは analyzeToken を保持し、投稿時に送り返すことで AI 結果を再取得できる。</p>
 *
 * <p>AI 解析が失敗した場合（Rekognition エラー、タイムアウト等）: 全フィールドを空・null にして
 * 200 OK で返す。フロントはトースト通知を表示し、ユーザーに手動入力を促す。</p>
 *
 * <p>Issue#132 で {@code parentFallbacks} と {@code exifRulesFired} を追加。
 * Issue#135 で {@code suggestedTags} を追加。発火・該当なしは空配列（null は使わない）。</p>
 *
 * @param categories       推定カテゴリコード（200番台）の配列。失敗時は空配列。
 * @param weather          推定天候コード（400番台）。失敗時または判定不可時は null。
 * @param confidence       各カテゴリ/天候の信頼度マップ。失敗時は空マップ。
 * @param analyzeToken     AI 結果の参照トークン（UUID v4）。失敗時は null。
 * @param parentFallbacks  Issue#132: 親ラベル経由でマッピングが成立した発火イベント一覧
 * @param exifRulesFired   Issue#132: EXIF ベースの補正ルール R1〜R5 の発火イベント一覧
 * @param suggestedTags    Issue#135: AI 提案キーワード（直接マッチのみ、最大 10 件）
 */
public record PhotoAnalyzeResponse(
        List<Integer> categories,
        Integer weather,
        Map<String, Float> confidence,
        String analyzeToken,
        List<ParentFallback> parentFallbacks,
        List<ExifRuleFire> exifRulesFired,
        List<TagSuggestion> suggestedTags
) {

    /** AI 解析が失敗した場合の空レスポンス。 */
    public static PhotoAnalyzeResponse empty() {
        return new PhotoAnalyzeResponse(
                List.of(), null, Map.of(), null,
                List.of(), List.of(), List.of()
        );
    }
}
