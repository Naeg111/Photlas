package com.photlas.backend.controller;

import com.photlas.backend.dto.AnalyzeExifInput;
import com.photlas.backend.dto.PhotoAnalyzeResponse;
import com.photlas.backend.service.PhotoAnalyzeService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

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

    /**
     * 画像を解析する。Issue#142: カテゴリ判定の EXIF ルール用に、フロントが抽出した EXIF 値を
     * 任意の追加フォーム値として受け取る（解析画像は EXIF が剥がされているため別送が必要）。
     * GPS 緯度経度は受け取らない。受け取った値は解析中のみ使用し保存しない。
     */
    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PhotoAnalyzeResponse> analyze(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "focalLength35mm", required = false) Integer focalLength35mm,
            @RequestParam(value = "iso", required = false) Integer iso,
            @RequestParam(value = "exposureTimeSeconds", required = false) Double exposureTimeSeconds,
            @RequestParam(value = "dateTimeOriginal", required = false) String dateTimeOriginal,
            @RequestParam(value = "gpsAltitude", required = false) Double gpsAltitude
    ) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("ファイルが空です");
        }
        AnalyzeExifInput exifInput = new AnalyzeExifInput(
                focalLength35mm, iso, exposureTimeSeconds, dateTimeOriginal, gpsAltitude);
        PhotoAnalyzeResponse response =
                photoAnalyzeService.analyze(file.getBytes(), file.getContentType(), exifInput);
        return ResponseEntity.ok(response);
    }
}
