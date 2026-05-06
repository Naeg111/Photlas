package com.photlas.backend.service;

import com.photlas.backend.dto.PhotoAnalyzeResponse;
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
import software.amazon.awssdk.services.rekognition.model.RekognitionException;

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

    @Spy
    private RekognitionLabelMapper labelMapper = new RekognitionLabelMapper();

    @InjectMocks
    private PhotoAnalyzeService service;

    @BeforeEach
    void setUp() {
        // 各テストで cacheService.save() は固定 token を返すようにする（必要なテストでのみ stub）
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
