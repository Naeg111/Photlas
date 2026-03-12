package com.photlas.backend.controller;

import com.photlas.backend.dto.ErrorResponse;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

/**
 * E2Eテスト用ユーティリティコントローラー
 * 本番環境では無効化される（@Profile("!prod")）
 */
@RestController
@RequestMapping("/api/v1/internal/test")
@Profile("!prod")
public class TestUtilityController {

    private static final String API_KEY_HEADER = "X-API-Key";

    @Value("${test.utility.api-key:e2e-test-api-key}")
    private String validApiKey;

    private final UserRepository userRepository;

    public TestUtilityController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * メール認証をバイパスする（E2Eテスト用）
     *
     * @param apiKey APIキー
     * @param request メールアドレスを含むリクエスト
     * @return 処理結果
     */
    @PostMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(
            @RequestHeader(API_KEY_HEADER) String apiKey,
            @RequestBody Map<String, String> request
    ) {
        if (!validApiKey.equals(apiKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("無効なAPIキーです"));
        }

        String email = request.get("email");
        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse("emailは必須です"));
        }

        Optional<User> userOptional = userRepository.findByEmail(email);
        if (userOptional.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("ユーザーが見つかりません"));
        }

        User user = userOptional.get();
        user.setEmailVerified(true);
        userRepository.save(user);

        return ResponseEntity.ok(Map.of("message", "メール認証が完了しました", "email", email));
    }
}
