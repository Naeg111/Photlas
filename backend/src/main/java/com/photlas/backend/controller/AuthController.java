package com.photlas.backend.controller;

import com.photlas.backend.dto.ConfirmLinkRequest;
import com.photlas.backend.dto.ErrorResponse;
import com.photlas.backend.dto.LoginRequest;
import com.photlas.backend.dto.PasswordResetRequest;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.RegisterResponse;
import com.photlas.backend.dto.ResetPasswordRequest;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.service.AccountService;
import com.photlas.backend.service.AuthService;
import com.photlas.backend.service.JwtService;
import com.photlas.backend.service.OAuthLinkConfirmationService;
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
    private final AccountService accountService;
    private final OAuthLinkConfirmationService oauthLinkConfirmationService;
    private final JwtService jwtService;

    public AuthController(
            AuthService authService,
            PasswordService passwordService,
            AccountService accountService,
            OAuthLinkConfirmationService oauthLinkConfirmationService,
            JwtService jwtService) {
        this.authService = authService;
        this.passwordService = passwordService;
        this.accountService = accountService;
        this.oauthLinkConfirmationService = oauthLinkConfirmationService;
        this.jwtService = jwtService;
    }

    /**
     * ユーザー登録エンドポイント
     */
    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(
            @Valid @RequestBody RegisterRequest request,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {
        RegisterResponse response = authService.registerUser(request, acceptLanguage);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * ログインエンドポイント
     */
    @PostMapping("/login")
    public ResponseEntity<RegisterResponse> login(
            @Valid @RequestBody LoginRequest request,
            @RequestHeader(value = "Accept-Language", required = false) String acceptLanguage) {
        RegisterResponse response = authService.loginUser(request, acceptLanguage);
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

    /**
     * Issue#86: メールアドレス変更確認
     * トークンを検証し、メールアドレスを更新してJWTを再発行する。
     */
    @GetMapping("/confirm-email-change")
    public ResponseEntity<Map<String, String>> confirmEmailChange(@RequestParam String token) {
        AccountService.EmailChangeResult result = accountService.confirmEmailChange(token);

        Map<String, String> response = new HashMap<>();
        response.put("token", result.token());
        response.put(FIELD_EMAIL, result.email());
        return ResponseEntity.ok(response);
    }

    /**
     * Issue#81 Phase 4g: OAuth アカウントリンク確認エンドポイント（Q1）。
     *
     * <p>既存パスワードアカウントに OAuth 連携を結ぶ際、ユーザーが LinkAccountConfirmDialog で
     * 「連携する」を選択すると本エンドポイントが呼ばれる。短命トークンを消費して
     * UserOAuthConnection を作成し、JWT を返す（リンク成功直後からログイン状態）。
     */
    @PostMapping("/oauth2/confirm-link")
    public ResponseEntity<Map<String, String>> confirmOAuthLink(@Valid @RequestBody ConfirmLinkRequest request) {
        User user = oauthLinkConfirmationService.consume(request.getToken());
        String jwt = jwtService.generateTokenWithRole(
                user.getEmail(), CodeConstants.roleToJwtString(user.getRole()));

        Map<String, String> response = new HashMap<>();
        response.put("token", jwt);
        response.put(FIELD_EMAIL, user.getEmail());
        return ResponseEntity.ok(response);
    }
}
