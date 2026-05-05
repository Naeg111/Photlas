package com.photlas.backend.service;

import com.photlas.backend.dto.PhotoAnalyzeResponse;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.rekognition.RekognitionClient;

/**
 * Issue#119: 写真の AI 解析を行うサービス。
 *
 * <p>処理フロー:</p>
 * <ol>
 *   <li>受信画像のフォーマット検証（JPEG/PNG のみ）</li>
 *   <li>長辺 1280px に縮小（Rekognition 5MB 制限内に収める）</li>
 *   <li>AWS Rekognition DetectLabels を呼び出し</li>
 *   <li>{@link RekognitionLabelMapper} で Photlas のカテゴリ/天候へマッピング</li>
 *   <li>{@link AiPredictionCacheService} で結果を一時保管し analyzeToken を発行</li>
 * </ol>
 *
 * <p>Rekognition エラー時は空のレスポンス（analyzeToken=null）を返し、
 * フロントは手動入力にフォールバックする（Issue#119 4.6）。</p>
 */
@Service
public class PhotoAnalyzeService {

    private final RekognitionClient rekognitionClient;
    private final RekognitionLabelMapper labelMapper;
    private final AiPredictionCacheService cacheService;

    public PhotoAnalyzeService(
            RekognitionClient rekognitionClient,
            RekognitionLabelMapper labelMapper,
            AiPredictionCacheService cacheService) {
        this.rekognitionClient = rekognitionClient;
        this.labelMapper = labelMapper;
        this.cacheService = cacheService;
    }

    /**
     * 受信画像を解析し、推定カテゴリ・天候・信頼度・analyzeToken を返す。
     *
     * @param imageBytes  画像バイナリ
     * @param contentType MIME タイプ（{@code image/jpeg} または {@code image/png}）
     * @return 解析結果。Rekognition 失敗時は {@link PhotoAnalyzeResponse#empty()}
     * @throws IllegalArgumentException 受信画像が JPEG/PNG 以外の場合
     */
    public PhotoAnalyzeResponse analyze(byte[] imageBytes, String contentType) {
        // Phase 4 Red 段階: スタブ実装
        return PhotoAnalyzeResponse.empty();
    }
}
