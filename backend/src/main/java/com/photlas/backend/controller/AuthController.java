package com.photlas.backend.controller;

import com.photlas.backend.dto.ErrorResponse;
import com.photlas.backend.dto.LoginRequest;
import com.photlas.backend.dto.PasswordResetRequest;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.RegisterResponse;
import com.photlas.backend.dto.ResetPasswordRequest;
import com.photlas.backend.service.AuthService;
import com.photlas.backend.service.PasswordService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 認証関連のエンドポイントを提供するコントローラー
 * 例外処理はGlobalExceptionHandlerに委譲する。
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private static final String KEY_MESSAGE = "message";
    private static final String FIELD_EMAIL = "email";

    private final AuthService authService;
    private final PasswordService passwordService;

    public AuthController(AuthService authService, PasswordService passwordService) {
        this.authService = authService;
        this.passwordService = passwordService;
    }

    /**
     * ユーザー登録エンドポイント
     */
    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        RegisterResponse response = authService.registerUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * ログインエンドポイント
     */
    @PostMapping("/login")
    public ResponseEntity<RegisterResponse> login(@Valid @RequestBody LoginRequest request) {
        RegisterResponse response = authService.loginUser(request);
        return ResponseEntity.ok(response);
    }

    /**
     * メールアドレス認証エンドポイント
     */
    @GetMapping("/verify-email")
    public ResponseEntity<Map<String, String>> verifyEmail(@RequestParam String token) {
        authService.verifyEmail(token);

        Map<String, String> response = new HashMap<>();
        response.put(KEY_MESSAGE, "メールアドレスの認証が完了しました。ログインしてください。");
        return ResponseEntity.ok(response);
    }

    /**
     * 認証メール再送エンドポイント
     */
    @PostMapping("/resend-verification")
    public ResponseEntity<?> resendVerification(@RequestBody Map<String, String> request) {
        String email = request.get(FIELD_EMAIL);
        if (email == null || email.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("メールアドレスは必須です"));
        }
        authService.resendVerificationEmail(email);

        Map<String, String> response = new HashMap<>();
        response.put(KEY_MESSAGE, "認証メールを再送信しました。メールをご確認ください。");
        return ResponseEntity.ok(response);
    }

    /**
     * パスワードリセットリクエスト
     */
    @PostMapping("/password-reset-request")
    public ResponseEntity<Map<String, String>> passwordResetRequest(@Valid @RequestBody PasswordResetRequest request) {
        passwordService.requestPasswordReset(request.getEmail());

        Map<String, String> response = new HashMap<>();
        response.put(KEY_MESSAGE, "パスワードリセット用のメールを送信しました。メールをご確認ください。");
        return ResponseEntity.ok(response);
    }

    /**
     * パスワード再設定
     */
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordService.resetPassword(request.getToken(), request.getNewPassword());

        Map<String, String> response = new HashMap<>();
        response.put(KEY_MESSAGE, "パスワードが正常に再設定されました");
        return ResponseEntity.ok(response);
    }
}
