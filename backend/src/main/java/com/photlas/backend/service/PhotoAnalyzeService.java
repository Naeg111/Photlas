package com.photlas.backend.service;

import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.dto.PhotoAnalyzeResponse;
import net.coobird.thumbnailator.Thumbnails;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.rekognition.RekognitionClient;
import software.amazon.awssdk.services.rekognition.model.DetectLabelsFeatureName;
import software.amazon.awssdk.services.rekognition.model.DetectLabelsRequest;
import software.amazon.awssdk.services.rekognition.model.DetectLabelsResponse;
import software.amazon.awssdk.services.rekognition.model.Image;
import software.amazon.awssdk.services.rekognition.model.RekognitionException;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Optional;
import java.util.Set;

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

    private static final Logger logger = LoggerFactory.getLogger(PhotoAnalyzeService.class);

    /** Issue#119 4.5: Rekognition の MinConfidence。80%未満は除外（誤検出を抑えるため引き上げ）。 */
    private static final float MIN_CONFIDENCE = 80f;

    /** Issue#119 4.5: 多すぎるとマッピング複雑化、少なすぎると見逃すため 30 が現実的。 */
    private static final int MAX_LABELS = 30;

    /** Issue#119 4.5: 長辺 1280px に縮小して Rekognition の 5MB 制限内に収める。 */
    private static final int MAX_DIMENSION_PX = 1280;

    /** Issue#119 4.5: 対応フォーマット。HEIC はフロント側で JPEG 変換済みの想定。 */
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("image/jpeg", "image/png");

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
     * @throws IllegalArgumentException 受信画像が JPEG/PNG 以外の場合、または画像として読み込めない場合
     */
    public PhotoAnalyzeResponse analyze(byte[] imageBytes, String contentType) {
        validateContentType(contentType);
        byte[] resized = resizeForRekognition(imageBytes);
        return callRekognitionSafely(resized)
                .map(this::mapAndCache)
                .orElseGet(PhotoAnalyzeResponse::empty);
    }

    /**
     * Rekognition を呼び出す。例外時は空 Optional を返してフォールバック動作させる
     * （Issue#119 4.6: フォーム空欄でユーザーに手動入力を促す）。
     */
    private Optional<DetectLabelsResponse> callRekognitionSafely(byte[] imageBytes) {
        try {
            return Optional.of(rekognitionClient.detectLabels(buildDetectLabelsRequest(imageBytes)));
        } catch (RekognitionException e) {
            logger.error("Rekognition DetectLabels 呼び出しに失敗しました（フォールバック: 空レスポンス）", e);
            return Optional.empty();
        }
    }

    /** Rekognition のレスポンスをマッピング → キャッシュ → DTO 構築まで一気通貫で行う。 */
    private PhotoAnalyzeResponse mapAndCache(DetectLabelsResponse rekognitionResponse) {
        LabelMappingResult mapped = labelMapper.map(rekognitionResponse.labels());
        String token = cacheService.save(mapped);
        return new PhotoAnalyzeResponse(mapped.categories(), mapped.weather(), mapped.confidence(), token);
    }

    private void validateContentType(String contentType) {
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase())) {
            throw new IllegalArgumentException(
                    "サポートされていない Content-Type です（image/jpeg, image/png のみ）: " + contentType);
        }
    }

    /**
     * 画像を長辺 {@value #MAX_DIMENSION_PX}px 以下に縮小する。
     * 既に小さい画像はそのまま返す（再エンコードのコストを避けるため）。
     */
    private byte[] resizeForRekognition(byte[] imageBytes) {
        BufferedImage img = readImage(imageBytes);
        int max = Math.max(img.getWidth(), img.getHeight());
        if (max <= MAX_DIMENSION_PX) {
            return imageBytes;
        }
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            Thumbnails.of(img)
                    .size(MAX_DIMENSION_PX, MAX_DIMENSION_PX)
                    .outputFormat("JPEG")
                    .toOutputStream(baos);
            return baos.toByteArray();
        } catch (IOException e) {
            // メモリ上の操作で IOException は通常発生しないが、念のため
            throw new IllegalStateException("画像の縮小に失敗しました", e);
        }
    }

    private BufferedImage readImage(byte[] imageBytes) {
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(imageBytes));
            if (img == null) {
                throw new IllegalArgumentException("画像として読み込めないバイト列です");
            }
            return img;
        } catch (IOException e) {
            throw new IllegalArgumentException("画像の読み込みに失敗しました", e);
        }
    }

    private DetectLabelsRequest buildDetectLabelsRequest(byte[] imageBytes) {
        return DetectLabelsRequest.builder()
                .image(Image.builder().bytes(SdkBytes.fromByteArray(imageBytes)).build())
                .minConfidence(MIN_CONFIDENCE)
                .maxLabels(MAX_LABELS)
                .features(DetectLabelsFeatureName.GENERAL_LABELS)
                .build();
    }
}
