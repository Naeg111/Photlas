package com.photlas.backend.dto;

/**
 * Issue#142: 解析リクエストでクライアントが任意に送る EXIF 値（生の未検証値）。
 *
 * <p>解析用画像はフロントの canvas 再エンコードで EXIF が剥がされるため、カテゴリ判定の
 * EXIF ルール（R1〜R5 / R3.5）に必要な値だけをフォーム値として別送する。
 * GPS 緯度経度は送らない（どのルールも使わない＋プライバシー）。</p>
 *
 * <p>値はクライアント由来＝信頼しない前提。妥当性チェック（範囲・パース）は
 * {@link com.photlas.backend.service.ExifReader#fromClientValues} が担い、解析後は保存しない。</p>
 *
 * <p>各フィールドは null 可（EXIF の無い写真）。</p>
 *
 * @param focalLength35mm    35mm 換算焦点距離（mm）
 * @param iso               ISO 感度
 * @param exposureTimeSeconds 露光時間（秒）
 * @param dateTimeOriginal  撮影日時（ISO8601 ローカル日時文字列。例: "2026-05-16T22:30:15"）
 * @param gpsAltitude       GPS 標高（メートル）
 */
public record AnalyzeExifInput(
        Integer focalLength35mm,
        Integer iso,
        Double exposureTimeSeconds,
        String dateTimeOriginal,
        Double gpsAltitude
) {

    /** 全フィールド null の空入力（EXIF の無い写真 / 後方互換）。 */
    public static AnalyzeExifInput empty() {
        return new AnalyzeExifInput(null, null, null, null, null);
    }

    /** 1 つも値が無い（= EXIF 別送なし）か。 */
    public boolean isEmpty() {
        return focalLength35mm == null && iso == null && exposureTimeSeconds == null
                && dateTimeOriginal == null && gpsAltitude == null;
    }
}
