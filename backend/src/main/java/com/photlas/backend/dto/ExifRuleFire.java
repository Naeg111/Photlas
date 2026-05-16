package com.photlas.backend.dto;

/**
 * Issue#132 3.4.1: EXIF ベースのスコア補正ルール (R1〜R5) 発火イベント。
 *
 * <p>GA4 アナリティクスイベント {@code ai_exif_rule_fired} のパラメータとして
 * フロントエンドへ返却され、フロントが GA4 へ送信する。</p>
 *
 * @param rule                "R1"〜"R5" のいずれか
 * @param categoryCode        加算対象カテゴリコード（200番台）
 * @param boostValue          加算値（例: R1=+30, R2=+20, R3=+10, R4=+20, R5=+10）
 * @param createdNewCandidate Rekognition 未検出カテゴリに新規候補として追加した場合 true、
 *                            既存候補のブーストの場合 false
 */
public record ExifRuleFire(
        String rule,
        int categoryCode,
        int boostValue,
        boolean createdNewCandidate
) {
}
