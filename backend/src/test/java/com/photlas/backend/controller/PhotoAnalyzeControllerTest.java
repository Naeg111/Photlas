package com.photlas.backend.controller;

import com.photlas.backend.dto.PhotoAnalyzeResponse;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.service.PhotoAnalyzeService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Issue#119 - {@link PhotoAnalyzeController} の HTTP 層テスト。
 *
 * <p>{@code @MockBean} で {@link PhotoAnalyzeService} を差し替え、ルーティング・認証・
 * multipart パース・レスポンス JSON 構造を検証する。サービス層の振る舞いは
 * {@link com.photlas.backend.service.PhotoAnalyzeServiceTest} で別途検証済み。</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PhotoAnalyzeControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private PhotoAnalyzeService photoAnalyzeService;

    private MockMultipartFile jpegFile() {
        return new MockMultipartFile(
                "file", "test.jpg", MediaType.IMAGE_JPEG_VALUE,
                "fake-jpeg-bytes".getBytes()
        );
    }

    private MockMultipartFile pngFile() {
        return new MockMultipartFile(
                "file", "test.png", MediaType.IMAGE_PNG_VALUE,
                "fake-png-bytes".getBytes()
        );
    }

    // ========== 正常系 ==========

    @Test
    @DisplayName("Issue#119 - POST /analyze: 認証済み + JPEG で 200、レスポンス JSON が期待構造")
    @WithMockUser
    void analyze_authenticatedJpeg_returns200WithBody() throws Exception {
        when(photoAnalyzeService.analyze(any(byte[].class), eq("image/jpeg")))
                .thenReturn(new PhotoAnalyzeResponse(
                        List.of(CodeConstants.CATEGORY_NATURE),
                        CodeConstants.WEATHER_SUNNY,
                        Map.of("201", 92.5f, "401", 85.0f),
                        "analyze-token-uuid"
                ));

        mockMvc.perform(multipart("/api/v1/photos/analyze").file(jpegFile()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categories", hasSize(1)))
                .andExpect(jsonPath("$.categories[0]", is(CodeConstants.CATEGORY_NATURE)))
                .andExpect(jsonPath("$.weather", is(CodeConstants.WEATHER_SUNNY)))
                .andExpect(jsonPath("$.analyzeToken", is("analyze-token-uuid")));
    }

    @Test
    @DisplayName("Issue#119 - POST /analyze: PNG も受け付ける")
    @WithMockUser
    void analyze_pngAlsoAccepted() throws Exception {
        when(photoAnalyzeService.analyze(any(byte[].class), eq("image/png")))
                .thenReturn(PhotoAnalyzeResponse.empty());

        mockMvc.perform(multipart("/api/v1/photos/analyze").file(pngFile()))
                .andExpect(status().isOk());

        verify(photoAnalyzeService).analyze(any(byte[].class), eq("image/png"));
    }

    @Test
    @DisplayName("Issue#119 - POST /analyze: Rekognition エラーで空レスポンスでも 200 を返す")
    @WithMockUser
    void analyze_emptyResponseStillReturns200() throws Exception {
        when(photoAnalyzeService.analyze(any(byte[].class), any()))
                .thenReturn(PhotoAnalyzeResponse.empty());

        mockMvc.perform(multipart("/api/v1/photos/analyze").file(jpegFile()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.categories", hasSize(0)))
                .andExpect(jsonPath("$.weather", is(nullValue())))
                .andExpect(jsonPath("$.analyzeToken", is(nullValue())));
    }

    // ========== 認証 ==========

    @Test
    @DisplayName("Issue#119 - POST /analyze: 未認証は 401")
    void analyze_unauthenticated_returns401() throws Exception {
        mockMvc.perform(multipart("/api/v1/photos/analyze").file(jpegFile()))
                .andExpect(status().isUnauthorized());
    }

    // ========== 入力エラー ==========

    @Test
    @DisplayName("Issue#119 - POST /analyze: file パートがない場合は 400")
    @WithMockUser
    void analyze_missingFilePart_returns400() throws Exception {
        mockMvc.perform(multipart("/api/v1/photos/analyze"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Issue#119 - POST /analyze: サービスが IllegalArgumentException を投げたら 400")
    @WithMockUser
    void analyze_serviceThrowsIllegalArgument_returns400() throws Exception {
        when(photoAnalyzeService.analyze(any(byte[].class), any()))
                .thenThrow(new IllegalArgumentException("不正な画像"));

        mockMvc.perform(multipart("/api/v1/photos/analyze").file(jpegFile()))
                .andExpect(status().isBadRequest());
    }
}
