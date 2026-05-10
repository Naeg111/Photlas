package com.photlas.backend.controller;

import com.photlas.backend.dto.ErrorResponse;
import com.photlas.backend.entity.Photo;
import com.photlas.backend.exception.PhotoNotFoundException;
import com.photlas.backend.repository.PhotoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Issue#125: Lambda→バックエンドの LQIP コールバックコントローラー。
 *
 * サムネイル生成 Lambda が LQIP（低品質プレースホルダー、data URL 形式）を生成し、
 * このエンドポイントにコールバックして DB の photos.lqip_data_url に書き込ませる。
 *
 * APIキーは既存の moderation コールバック (Issue#54) と共用。
 * 同じ "Lambda → Backend internal" 用途であり、ローテーション運用も統一できる。
 */
@RestController
@RequestMapping("/api/v1/internal/photos")
public class LqipCallbackController {

    private static final Logger logger = LoggerFactory.getLogger(LqipCallbackController.class);
    private static final String API_KEY_HEADER = "X-API-Key";
    private static final String FIELD_S3_OBJECT_KEY = "s3_object_key";
    private static final String FIELD_LQIP_DATA_URL = "lqip_data_url";
    private static final String KEY_MESSAGE = "message";

    /** 防御的措置: lqip_data_url の最大サイズ。想定値は ~800 byte。 */
    private static final int MAX_LQIP_DATA_URL_LENGTH = 10 * 1024;

    @Value("${moderation.api-key:test-moderation-api-key}")
    private String validApiKey;

    private final PhotoRepository photoRepository;

    public LqipCallbackController(PhotoRepository photoRepository) {
        this.photoRepository = photoRepository;
    }

    /**
     * LQIP コールバック。
     * Lambda が生成した data URL 形式の LQIP を photos.lqip_data_url に保存する。
     *
     * リクエスト: { "s3_object_key": "uploads/.../abc.jpg", "lqip_data_url": "data:image/webp;base64,..." }
     * 認証: X-API-Key ヘッダ
     */
    @PostMapping("/lqip")
    public ResponseEntity<?> handleLqipCallback(
            @RequestHeader(API_KEY_HEADER) String apiKey,
            @RequestBody Map<String, Object> request
    ) {
        if (!validApiKey.equals(apiKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("無効なAPIキーです"));
        }

        String s3ObjectKey = (String) request.get(FIELD_S3_OBJECT_KEY);
        String lqipDataUrl = (String) request.get(FIELD_LQIP_DATA_URL);

        if (s3ObjectKey == null || s3ObjectKey.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of(KEY_MESSAGE, "s3_object_key is required"));
        }
        if (lqipDataUrl == null || lqipDataUrl.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of(KEY_MESSAGE, "lqip_data_url is required"));
        }
        if (lqipDataUrl.length() > MAX_LQIP_DATA_URL_LENGTH) {
            return ResponseEntity.badRequest()
                    .body(Map.of(KEY_MESSAGE,
                            "lqip_data_url exceeds max size (" + MAX_LQIP_DATA_URL_LENGTH + " bytes)"));
        }

        Photo photo = photoRepository.findByS3ObjectKey(s3ObjectKey)
                .orElseThrow(() -> new PhotoNotFoundException("写真が見つかりません: " + s3ObjectKey));

        photo.setLqipDataUrl(lqipDataUrl);
        photoRepository.save(photo);

        logger.info("LQIP saved: photoId={}, s3_object_key={}, lqip_size={} chars",
                photo.getPhotoId(), s3ObjectKey, lqipDataUrl.length());

        return ResponseEntity.ok().build();
    }
}
