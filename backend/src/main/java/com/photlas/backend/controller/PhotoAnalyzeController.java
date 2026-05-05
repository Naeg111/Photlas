package com.photlas.backend.controller;

import com.photlas.backend.dto.PhotoAnalyzeResponse;
import com.photlas.backend.service.PhotoAnalyzeService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Issue#119: 写真の AI 解析エンドポイント。
 *
 * <p>{@code POST /api/v1/photos/analyze} で {@code multipart/form-data} の画像を受け取り、
 * AWS Rekognition で解析した結果（推定カテゴリ・天候・analyzeToken）を返す。</p>
 *
 * <p>認証必須（Spring Security の {@code .anyRequest().authenticated()} ルールで自動保護）。
 * エラー時の挙動は {@link PhotoAnalyzeService} を参照。</p>
 */
@RestController
@RequestMapping("/api/v1/photos")
public class PhotoAnalyzeController {

    private final PhotoAnalyzeService photoAnalyzeService;

    public PhotoAnalyzeController(PhotoAnalyzeService photoAnalyzeService) {
        this.photoAnalyzeService = photoAnalyzeService;
    }

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PhotoAnalyzeResponse> analyze(@RequestParam("file") MultipartFile file) {
        // Phase 5 Red 段階: スタブ実装
        return ResponseEntity.ok(PhotoAnalyzeResponse.empty());
    }
}
