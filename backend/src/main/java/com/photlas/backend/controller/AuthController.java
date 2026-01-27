package com.photlas.backend.controller;

import com.photlas.backend.dto.ErrorResponse;
import com.photlas.backend.dto.LoginRequest;
import com.photlas.backend.dto.PasswordResetRequest;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.RegisterResponse;
import com.photlas.backend.dto.ResetPasswordRequest;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.service.UserService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 認証関連のエンドポイントを提供するコントローラー
 * Issue#6: パスワードリセット機能
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final UserService userService;

    public AuthController(UserService userService) {
        this.userService = userService;
    }

    /**
     * バリデーションエラーをレスポンスに変換するヘルパーメソッド
     *
     * @param bindingResult バリデーション結果
     * @return エラーレスポンス
     */
    private ResponseEntity<?> buildValidationErrorResponse(BindingResult bindingResult) {
        List<ErrorResponse.FieldError> fieldErrors = bindingResult.getFieldErrors().stream()
            .map(error -> new ErrorResponse.FieldError(
                error.getField(),
                error.getRejectedValue(),
                error.getDefaultMessage()
            ))
            .collect(Collectors.toList());

        ErrorResponse errorResponse = new ErrorResponse("Validation failed", fieldErrors);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
    }

    /**
     * ユーザー登録エンドポイント
     *
     * @param request 登録リクエスト
     * @param bindingResult バリデーション結果
     * @return 登録レスポンス
     */
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request, BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            return buildValidationErrorResponse(bindingResult);
        }

        try {
            RegisterResponse response = userService.registerUser(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (ConflictException e) {
            List<ErrorResponse.FieldError> fieldErrors = List.of(
                new ErrorResponse.FieldError("email", request.getEmail(), e.getMessage())
            );
            ErrorResponse errorResponse = new ErrorResponse("Conflict", fieldErrors);
            return ResponseEntity.status(HttpStatus.CONFLICT).body(errorResponse);
        } catch (IllegalArgumentException e) {
            List<ErrorResponse.FieldError> fieldErrors = List.of(
                new ErrorResponse.FieldError("email", request.getEmail(), e.getMessage())
            );
            ErrorResponse errorResponse = new ErrorResponse("Validation failed", fieldErrors);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
        } catch (Exception e) {
            ErrorResponse errorResponse = new ErrorResponse("Internal server error");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * ログインエンドポイント
     *
     * @param request ログインリクエスト
     * @param bindingResult バリデーション結果
     * @return ログインレスポンス
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            return buildValidationErrorResponse(bindingResult);
        }

        try {
            RegisterResponse response = userService.loginUser(request);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            ErrorResponse errorResponse = new ErrorResponse("メールアドレスまたはパスワードが正しくありません");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(errorResponse);
        } catch (Exception e) {
            ErrorResponse errorResponse = new ErrorResponse("Internal server error");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * パスワードリセットリクエスト
     * Issue#6: パスワードリセット機能
     *
     * @param request パスワードリセットリクエスト
     * @param bindingResult バリデーション結果
     * @return レスポンス
     */
    @PostMapping("/password-reset-request")
    public ResponseEntity<?> passwordResetRequest(@Valid @RequestBody PasswordResetRequest request, BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            return buildValidationErrorResponse(bindingResult);
        }

        try {
            userService.requestPasswordReset(request.getEmail());

            // セキュリティ上、メールアドレスが存在するかどうかに関わらず同じレスポンスを返す
            Map<String, String> response = new HashMap<>();
            response.put("message", "パスワードリセット用のメールを送信しました。メールをご確認ください。");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            ErrorResponse errorResponse = new ErrorResponse("Internal server error");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }

    /**
     * パスワード再設定
     * Issue#6: パスワードリセット機能
     *
     * @param request パスワード再設定リクエスト
     * @param bindingResult バリデーション結果
     * @return レスポンス
     */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody ResetPasswordRequest request, BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            return buildValidationErrorResponse(bindingResult);
        }

        try {
            userService.resetPassword(request.getToken(), request.getNewPassword(), request.getConfirmPassword());

            Map<String, String> response = new HashMap<>();
            response.put("message", "パスワードが正常に再設定されました");
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            ErrorResponse errorResponse = new ErrorResponse(e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
        } catch (Exception e) {
            ErrorResponse errorResponse = new ErrorResponse("Internal server error");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
}