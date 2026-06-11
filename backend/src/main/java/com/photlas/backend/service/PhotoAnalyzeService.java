package com.photlas.backend.service;

import com.photlas.backend.dto.AnalyzeExifInput;
import com.photlas.backend.dto.CachedAnalyzeResult;
import com.photlas.backend.dto.ExifData;
import com.photlas.backend.dto.LabelMappingResult;
import com.photlas.backend.dto.PhotoAnalyzeResponse;
import com.photlas.backend.dto.TagSuggestion;
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
import java.util.List;
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
    private final ExifReader exifReader;
    private final ExifBasedCategoryHints exifHints;
    private final TagService tagService;

    public PhotoAnalyzeService(
            RekognitionClient rekognitionClient,
            RekognitionLabelMapper labelMapper,
            ExifReader exifReader,
            ExifBasedCategoryHints exifHints,
            TagService tagService,
            AiPredictionCacheService cacheService) {
        this.rekognitionClient = rekognitionClient;
        this.labelMapper = labelMapper;
        this.exifReader = exifReader;
        this.exifHints = exifHints;
        this.tagService = tagService;
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
        return analyze(imageBytes, contentType, AnalyzeExifInput.empty());
    }

    /**
     * Issue#142: クライアントが別送した EXIF 値（{@code exifInput}）を用いて解析する。
     *
     * <p>解析用画像はフロントの canvas 再エンコードで EXIF が剥がされているため、フォーム値由来の
     * EXIF を優先する。{@code exifInput} が空（EXIF 無し写真 / 後方互換の 2 引数呼び出し）の場合のみ、
     * 元バイト列から読む（通常は空）。受け取った EXIF 値は解析中のみ使用し保存しない。</p>
     *
     * @param imageBytes  画像バイナリ
     * @param contentType MIME タイプ（{@code image/jpeg} または {@code image/png}）
     * @param exifInput   クライアント送信の EXIF 値（null/空可）
     * @return 解析結果。Rekognition 失敗時は {@link PhotoAnalyzeResponse#empty()}
     * @throws IllegalArgumentException 受信画像が JPEG/PNG 以外の場合、または画像として読み込めない場合
     */
    public PhotoAnalyzeResponse analyze(byte[] imageBytes, String contentType, AnalyzeExifInput exifInput) {
        validateContentType(contentType);
        // Issue#142: 解析画像は EXIF が剥がされているため、別送された EXIF 値を優先して使う。
        // 別送が無い（空）場合のみ後方互換でバイト列から読む（通常は空）。
        ExifData exif = (exifInput == null || exifInput.isEmpty())
                ? exifReader.read(imageBytes)
                : exifReader.fromClientValues(exifInput);
        byte[] resized = resizeForRekognition(imageBytes);
        return callRekognitionSafely(resized)
                .map(rekResp -> mapAndCache(rekResp, exif))
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

    /**
     * Rekognition のレスポンスをマッピング → EXIF 補正 → キャッシュ → DTO 構築まで一気通貫で行う。
     * Issue#132: 親フォールバック・EXIF ルール発火イベントをレスポンスに含める。
     * Issue#135: AI 提案キーワード (suggestedTags) も併せて取得・含める。
     */
    private PhotoAnalyzeResponse mapAndCache(DetectLabelsResponse rekognitionResponse, ExifData exif) {
        RekognitionLabelMapper.MappingResult mapping = labelMapper.mapWithEvents(rekognitionResponse.labels());
        ExifBasedCategoryHints.Applied applied = exifHints.apply(mapping.result(), exif);
        LabelMappingResult finalResult = applied.result();
        List<TagSuggestion> suggestedTags =
                tagService.extractSuggestions(rekognitionResponse.labels(), exif.focalLength35mm());
        // Issue#136 Q10/§4.4: labelMapping と suggestedTags を一括キャッシュ（ai_confidence 補完用）
        String token = cacheService.save(new CachedAnalyzeResult(finalResult, suggestedTags));
        return new PhotoAnalyzeResponse(
                finalResult.categories(),
                finalResult.weather(),
                finalResult.confidence(),
                token,
                mapping.parentFallbacks(),
                applied.rulesFired(),
                suggestedTags
        );
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
