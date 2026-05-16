package com.photlas.backend.service;

import com.photlas.backend.dto.ExifData;
import com.photlas.backend.dto.ExifRuleFire;
import com.photlas.backend.dto.ParentFallback;
import com.photlas.backend.dto.PhotoAnalyzeResponse;
import com.photlas.backend.dto.TagSuggestion;
import com.photlas.backend.entity.CodeConstants;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.rekognition.RekognitionClient;
import software.amazon.awssdk.services.rekognition.model.DetectLabelsRequest;
import software.amazon.awssdk.services.rekognition.model.DetectLabelsResponse;
import software.amazon.awssdk.services.rekognition.model.Label;
import software.amazon.awssdk.services.rekognition.model.Parent;
import software.amazon.awssdk.services.rekognition.model.RekognitionException;

import java.time.LocalDateTime;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Issue#119 - {@link PhotoAnalyzeService} のユニットテスト。
 *
 * <p>Rekognition と AiPredictionCacheService は Mockito でモック化し、
 * RekognitionLabelMapper は実体を使用する（純粋ロジックのため）。</p>
 *
 * <p>テスト範囲: フォーマット検証、画像縮小、Rekognition 呼び出しパラメータ、
 * ラベル → カテゴリマッピング、キャッシュ連携、エラーハンドリング。</p>
 */
@ExtendWith(MockitoExtension.class)
class PhotoAnalyzeServiceTest {

    private static final String JPEG = "image/jpeg";
    private static final String PNG = "image/png";

    @Mock
    private RekognitionClient rekognitionClient;

    @Mock
    private AiPredictionCacheService cacheService;

    @Mock
    private ExifReader exifReader;

    @Mock
    private TagService tagService;

    @Spy
    private RekognitionLabelMapper labelMapper = new RekognitionLabelMapper();

    @Spy
    private ExifBasedCategoryHints exifHints = new ExifBasedCategoryHints();

    @InjectMocks
    private PhotoAnalyzeService service;

    @BeforeEach
    void setUp() {
        // 各テストで cacheService.save() は固定 token を返すようにする（必要なテストでのみ stub）
        // ExifReader はデフォルトで空 EXIF を返す（必要なテストでのみ上書き）
        org.mockito.Mockito.lenient().when(exifReader.read(org.mockito.ArgumentMatchers.any()))
                .thenReturn(ExifData.empty());
        // Issue#135: TagService.extractSuggestions はデフォルトで空配列
        org.mockito.Mockito.lenient().when(tagService.extractSuggestions(org.mockito.ArgumentMatchers.any()))
                .thenReturn(List.of());
    }

    // ========== 正常系: Rekognition 呼び出しとマッピング ==========

    @Test
    @DisplayName("Issue#119 - analyze: 有効な JPEG で Rekognition を呼び出し、マッピング結果を返す")
    void analyze_validJpeg_returnsMappedCategories() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder()
                        .labels(List.of(
                                Label.builder().name("Mountain").confidence(85f).build()
                        ))
                        .build());
        when(cacheService.save(any())).thenReturn("token-uuid");

        byte[] jpeg = createJpeg(640, 480);
        PhotoAnalyzeResponse response = service.analyze(jpeg, JPEG);

        assertThat(response.categories()).containsExactly(CodeConstants.CATEGORY_NATURE);
        assertThat(response.analyzeToken()).isEqualTo("token-uuid");
    }

    @Test
    @DisplayName("Issue#119 - analyze: PNG 形式も受け付ける")
    void analyze_validPng_returnsMappedCategories() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder()
                        .labels(List.of(Label.builder().name("Building").confidence(80f).build()))
                        .build());
        when(cacheService.save(any())).thenReturn("token");

        byte[] png = createPng(640, 480);
        PhotoAnalyzeResponse response = service.analyze(png, PNG);

        assertThat(response.categories()).containsExactly(CodeConstants.CATEGORY_ARCHITECTURE);
    }

    @Test
    @DisplayName("Issue#119 - analyze: Rekognition 呼び出しに MinConfidence=80, MaxLabels=30 が設定される")
    void analyze_setsRekognitionRequestParameters() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder().labels(List.of()).build());
        when(cacheService.save(any())).thenReturn("token");

        service.analyze(createJpeg(640, 480), JPEG);

        ArgumentCaptor<DetectLabelsRequest> captor = ArgumentCaptor.forClass(DetectLabelsRequest.class);
        verify(rekognitionClient).detectLabels(captor.capture());
        DetectLabelsRequest request = captor.getValue();
        assertThat(request.minConfidence()).isEqualTo(80f);
        assertThat(request.maxLabels()).isEqualTo(30);
    }

    // ========== 画像縮小 ==========

    @Test
    @DisplayName("Issue#119 - analyze: 長辺 1280px を超える画像は縮小して Rekognition に送る")
    void analyze_largeImage_isResizedTo1280px() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder().labels(List.of()).build());
        when(cacheService.save(any())).thenReturn("token");

        byte[] largeJpeg = createJpeg(2560, 1920);
        service.analyze(largeJpeg, JPEG);

        ArgumentCaptor<DetectLabelsRequest> captor = ArgumentCaptor.forClass(DetectLabelsRequest.class);
        verify(rekognitionClient).detectLabels(captor.capture());
        SdkBytes sentBytes = captor.getValue().image().bytes();
        BufferedImage sentImage = ImageIO.read(new ByteArrayInputStream(sentBytes.asByteArray()));
        int sentMax = Math.max(sentImage.getWidth(), sentImage.getHeight());
        assertThat(sentMax).isLessThanOrEqualTo(1280);
    }

    @Test
    @DisplayName("Issue#119 - analyze: 長辺 1280px 以下の画像はそのまま Rekognition に送る（縮小しない）")
    void analyze_smallImage_isNotResized() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder().labels(List.of()).build());
        when(cacheService.save(any())).thenReturn("token");

        byte[] smallJpeg = createJpeg(800, 600);
        service.analyze(smallJpeg, JPEG);

        ArgumentCaptor<DetectLabelsRequest> captor = ArgumentCaptor.forClass(DetectLabelsRequest.class);
        verify(rekognitionClient).detectLabels(captor.capture());
        SdkBytes sentBytes = captor.getValue().image().bytes();
        BufferedImage sentImage = ImageIO.read(new ByteArrayInputStream(sentBytes.asByteArray()));
        // 元と同じサイズ（800x600）
        assertThat(sentImage.getWidth()).isEqualTo(800);
        assertThat(sentImage.getHeight()).isEqualTo(600);
    }

    // ========== analyzeToken / キャッシュ連携 ==========

    @Test
    @DisplayName("Issue#119 - analyze: 解析結果を AiPredictionCacheService.save() に渡してキャッシュする")
    void analyze_cachesResultViaCacheService() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder()
                        .labels(List.of(Label.builder().name("Mountain").confidence(85f).build()))
                        .build());
        when(cacheService.save(any())).thenReturn(UUID.randomUUID().toString());

        service.analyze(createJpeg(640, 480), JPEG);

        verify(cacheService).save(any());
    }

    @Test
    @DisplayName("Issue#119 - analyze: 空のラベル結果でもトークンは発行される")
    void analyze_emptyLabels_stillIssuesToken() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder().labels(List.of()).build());
        when(cacheService.save(any())).thenReturn("token-empty");

        PhotoAnalyzeResponse response = service.analyze(createJpeg(640, 480), JPEG);

        assertThat(response.categories()).isEmpty();
        assertThat(response.weather()).isNull();
        assertThat(response.analyzeToken()).isEqualTo("token-empty");
    }

    // ========== フォーマット検証 ==========

    @Test
    @DisplayName("Issue#119 - analyze: JPEG/PNG 以外の Content-Type は IllegalArgumentException")
    void analyze_unsupportedContentType_throws() {
        byte[] anyBytes = "fake".getBytes();

        assertThatThrownBy(() -> service.analyze(anyBytes, "application/pdf"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.analyze(anyBytes, "image/gif"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.analyze(anyBytes, "image/webp"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Issue#119 - analyze: 不正なバイト列は IllegalArgumentException")
    void analyze_invalidImageBytes_throws() {
        byte[] notImage = "not an image at all".getBytes();

        assertThatThrownBy(() -> service.analyze(notImage, JPEG))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("Issue#119 - analyze: 不正な入力では Rekognition を呼び出さない")
    void analyze_invalidInput_doesNotCallRekognition() {
        byte[] notImage = "not an image".getBytes();

        try {
            service.analyze(notImage, JPEG);
        } catch (IllegalArgumentException ignored) {
            // 期待される例外
        }

        verify(rekognitionClient, never()).detectLabels(any(DetectLabelsRequest.class));
        verify(cacheService, never()).save(any());
    }

    // ========== Rekognition エラー ==========

    @Test
    @DisplayName("Issue#119 - analyze: Rekognition が例外を投げた場合、空レスポンスを返す（フォーム空欄でフォールバック）")
    void analyze_rekognitionThrows_returnsEmptyResponse() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenThrow(RekognitionException.builder().message("AWS service down").build());

        PhotoAnalyzeResponse response = service.analyze(createJpeg(640, 480), JPEG);

        assertThat(response.categories()).isEmpty();
        assertThat(response.weather()).isNull();
        assertThat(response.confidence()).isEmpty();
        assertThat(response.analyzeToken()).isNull();
    }

    @Test
    @DisplayName("Issue#119 - analyze: Rekognition エラー時はキャッシュにも保存しない")
    void analyze_rekognitionError_doesNotCache() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenThrow(RekognitionException.builder().message("AWS service down").build());

        service.analyze(createJpeg(640, 480), JPEG);

        verify(cacheService, never()).save(any());
    }

    // ========== Issue#132: 親子フォールバック・EXIF 連携 ==========

    @Test
    @DisplayName("Issue#132 - analyze: 親フォールバックが発火した場合、response.parentFallbacks に記録される")
    void analyze_parentFallback_isTrackedInResponse() throws IOException {
        Label husky = Label.builder()
                .name("Husky").confidence(90f)
                .parents(List.of(Parent.builder().name("Dog").build()))
                .build();
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder().labels(List.of(husky)).build());
        when(cacheService.save(any())).thenReturn("token");

        PhotoAnalyzeResponse response = service.analyze(createJpeg(640, 480), JPEG);

        assertThat(response.parentFallbacks())
                .extracting(ParentFallback::childLabel, ParentFallback::parentLabel,
                        ParentFallback::categoryCode)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple("Husky", "Dog", CodeConstants.CATEGORY_ANIMALS));
        // カテゴリ自体も正しくマッピングされる
        assertThat(response.categories()).contains(CodeConstants.CATEGORY_ANIMALS);
    }

    @Test
    @DisplayName("Issue#132 - analyze: EXIF R1 (星空) が発火した場合、response.exifRulesFired と categories に反映される")
    void analyze_exifRuleR1_isTrackedInResponse() throws IOException {
        ExifData starrySky = ExifData.builder()
                .dateTimeOriginal(LocalDateTime.of(2026, 5, 16, 22, 0))
                .exposureTimeSeconds(15.0)
                .iso(1600)
                .build();
        when(exifReader.read(any())).thenReturn(starrySky);
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder().labels(List.of()).build());
        when(cacheService.save(any())).thenReturn("token");

        PhotoAnalyzeResponse response = service.analyze(createJpeg(640, 480), JPEG);

        assertThat(response.exifRulesFired())
                .extracting(ExifRuleFire::rule)
                .contains("R1");
        assertThat(response.categories()).contains(CodeConstants.CATEGORY_STARRY_SKY);
    }

    @Test
    @DisplayName("Issue#132 - analyze: 発火なしの場合、parentFallbacks/exifRulesFired は空配列")
    void analyze_noFallbackOrExifRule_returnsEmptyArrays() throws IOException {
        Label dog = Label.builder().name("Dog").confidence(90f).build();
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder().labels(List.of(dog)).build());
        when(cacheService.save(any())).thenReturn("token");

        PhotoAnalyzeResponse response = service.analyze(createJpeg(640, 480), JPEG);

        assertThat(response.parentFallbacks()).isEmpty();
        assertThat(response.exifRulesFired()).isEmpty();
    }

    @Test
    @DisplayName("Issue#132 - analyze: Rekognition 失敗時の empty レスポンスでも新規フィールドは空配列")
    void analyze_rekognitionError_hasEmptyNewArrays() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenThrow(RekognitionException.builder().message("AWS down").build());

        PhotoAnalyzeResponse response = service.analyze(createJpeg(640, 480), JPEG);

        assertThat(response.parentFallbacks()).isEmpty();
        assertThat(response.exifRulesFired()).isEmpty();
    }

    @Test
    @DisplayName("Issue#132 - analyze: EXIF はリサイズ前の元画像から読み取る")
    void analyze_exifIsReadFromOriginalBytesBeforeResize() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder().labels(List.of()).build());
        when(cacheService.save(any())).thenReturn("token");

        byte[] largeJpeg = createJpeg(2560, 1920);
        service.analyze(largeJpeg, JPEG);

        // ExifReader は元の画像バイト列で呼ばれる（縮小前）
        ArgumentCaptor<byte[]> captor = ArgumentCaptor.forClass(byte[].class);
        verify(exifReader).read(captor.capture());
        assertThat(captor.getValue()).isEqualTo(largeJpeg);
    }

    @Test
    @DisplayName("Issue#132 - PhotoAnalyzeResponse.empty(): 新規フィールドも空配列で返す")
    void emptyResponse_hasEmptyNewArrays() {
        PhotoAnalyzeResponse empty = PhotoAnalyzeResponse.empty();

        assertThat(empty.parentFallbacks()).isEmpty();
        assertThat(empty.exifRulesFired()).isEmpty();
        assertThat(empty.suggestedTags()).isEmpty();
    }

    // ========== Issue#135: AI キーワード提案 ==========

    @Test
    @DisplayName("Issue#135 - analyze: TagService から取得した suggestedTags をレスポンスに含める")
    void analyze_suggestedTags_areIncludedInResponse() throws IOException {
        Label cherryLabel = Label.builder().name("Cherry Blossom").confidence(92.0f).build();
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder().labels(List.of(cherryLabel)).build());
        when(cacheService.save(any())).thenReturn("token");
        when(tagService.extractSuggestions(any()))
                .thenReturn(List.of(new TagSuggestion(7L, "cherry-blossom", "Cherry Blossom", 92.0f)));

        PhotoAnalyzeResponse response = service.analyze(createJpeg(640, 480), JPEG);

        assertThat(response.suggestedTags()).hasSize(1);
        assertThat(response.suggestedTags().get(0).slug()).isEqualTo("cherry-blossom");
        assertThat(response.suggestedTags().get(0).tagId()).isEqualTo(7L);
    }

    @Test
    @DisplayName("Issue#135 - analyze: TagService が空配列を返したら suggestedTags も空配列")
    void analyze_emptySuggestions_isReturnedAsEmptyArray() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenReturn(DetectLabelsResponse.builder().labels(List.of()).build());
        when(cacheService.save(any())).thenReturn("token");

        PhotoAnalyzeResponse response = service.analyze(createJpeg(640, 480), JPEG);

        assertThat(response.suggestedTags()).isEmpty();
    }

    @Test
    @DisplayName("Issue#135 - analyze: Rekognition 失敗時の empty レスポンスでも suggestedTags は空配列")
    void analyze_rekognitionError_hasEmptySuggestedTags() throws IOException {
        when(rekognitionClient.detectLabels(any(DetectLabelsRequest.class)))
                .thenThrow(RekognitionException.builder().message("AWS down").build());

        PhotoAnalyzeResponse response = service.analyze(createJpeg(640, 480), JPEG);

        assertThat(response.suggestedTags()).isEmpty();
    }

    // ========== ヘルパー ==========

    /** テスト用の単色 JPEG 画像を生成する。 */
    private byte[] createJpeg(int width, int height) throws IOException {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.GRAY);
        g.fillRect(0, 0, width, height);
        g.dispose();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "JPEG", baos);
        return baos.toByteArray();
    }

    /** テスト用の単色 PNG 画像を生成する。 */
    private byte[] createPng(int width, int height) throws IOException {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.GRAY);
        g.fillRect(0, 0, width, height);
        g.dispose();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "PNG", baos);
        return baos.toByteArray();
    }
}
