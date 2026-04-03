package com.photlas.backend.controller;

import com.photlas.backend.dto.ErrorResponse;
import com.photlas.backend.dto.LoginRequest;
import com.photlas.backend.dto.PasswordResetRequest;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.RegisterResponse;
import com.photlas.backend.dto.ResetPasswordRequest;
import com.photlas.backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

/**
 * 認証関連のエンドポイントを提供するコントローラー
 *
 * 例外処理はGlobalExceptionHandlerに委譲する。
 * バリデーションエラーはSpring MVCが自動的にMethodArgumentNotValidExceptionをスローし、
 * GlobalExceptionHandler.handleMethodArgumentNotValidで処理される。
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private static final String KEY_MESSAGE = "message";
    private static final String FIELD_EMAIL = "email";

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    /**
     * ユーザー登録エンドポイント
     *
     * @param request 登録リクエスト
     * @return 登録レスポンス
     */
    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        RegisterResponse response = userService.registerUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * ログインエンドポイント
     *
     * @param request ログインリクエスト
     * @return ログインレスポンス
     */
    @PostMapping("/login")
    public ResponseEntity<RegisterResponse> login(@Valid @RequestBody LoginRequest request) {
        RegisterResponse response = userService.loginUser(request);
        return ResponseEntity.ok(response);
    }

    /**
     * メールアドレス認証エンドポイント
     *
     * @param token 認証トークン
     * @return レスポンス
     */
    @GetMapping("/verify-email")
    public ResponseEntity<Map<String, String>> verifyEmail(@RequestParam String token) {
        userService.verifyEmail(token);

        Map<String, String> response = new HashMap<>();
        response.put(KEY_MESSAGE, "メールアドレスの認証が完了しました。ログインしてください。");
        return ResponseEntity.ok(response);
    }

    /**
     * 認証メール再送エンドポイント
     *
     * @param request メールアドレスを含むリクエスト
     * @return レスポンス
     */
    @PostMapping("/resend-verification")
    public ResponseEntity<?> resendVerification(@RequestBody Map<String, String> request) {
        String email = request.get(FIELD_EMAIL);
        if (email == null || email.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ErrorResponse("メールアドレスは必須です"));
        }
        userService.resendVerificationEmail(email);

        Map<String, String> response = new HashMap<>();
        response.put(KEY_MESSAGE, "認証メールを再送信しました。メールをご確認ください。");
        return ResponseEntity.ok(response);
    }

    /**
     * パスワードリセットリクエスト
     * Issue#6: パスワードリセット機能
     *
     * @param request パスワードリセットリクエスト
     * @return レスポンス
     */
    @PostMapping("/password-reset-request")
    public ResponseEntity<Map<String, String>> passwordResetRequest(@Valid @RequestBody PasswordResetRequest request) {
        userService.requestPasswordReset(request.getEmail());

        // セキュリティ上、メールアドレスが存在するかどうかに関わらず同じレスポンスを返す
        Map<String, String> response = new HashMap<>();
        response.put(KEY_MESSAGE, "パスワードリセット用のメールを送信しました。メールをご確認ください。");
        return ResponseEntity.ok(response);
    }

    /**
     * パスワード再設定
     * Issue#6: パスワードリセット機能
     *
     * @param request パスワード再設定リクエスト
     * @return レスポンス
     */
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        userService.resetPassword(request.getToken(), request.getNewPassword(), request.getConfirmPassword());

        Map<String, String> response = new HashMap<>();
        response.put(KEY_MESSAGE, "パスワードが正常に再設定されました");
        return ResponseEntity.ok(response);
    }
}
