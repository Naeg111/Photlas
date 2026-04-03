package com.photlas.backend.controller;

import com.photlas.backend.dto.DeleteAccountRequest;
import com.photlas.backend.dto.UpdateEmailRequest;
import com.photlas.backend.dto.UpdateEmailResponse;
import com.photlas.backend.dto.UpdatePasswordRequest;
import com.photlas.backend.service.AccountService;
import com.photlas.backend.service.PasswordService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * アカウント設定関連のエンドポイントを提供するコントローラー
 * 例外処理はGlobalExceptionHandlerに委譲する。
 */
@RestController
@RequestMapping("/api/v1/users/me")
public class AccountController {

    private final AccountService accountService;
    private final PasswordService passwordService;

    public AccountController(AccountService accountService, PasswordService passwordService) {
        this.accountService = accountService;
        this.passwordService = passwordService;
    }

    /**
     * メールアドレス変更
     * PUT /api/v1/users/me/email
     */
    @PutMapping("/email")
    public ResponseEntity<UpdateEmailResponse> updateEmail(
            @Valid @RequestBody UpdateEmailRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        String updatedEmail = accountService.updateEmail(email, request.getNewEmail(), request.getCurrentPassword());
        return ResponseEntity.ok(new UpdateEmailResponse(updatedEmail));
    }

    /**
     * パスワード変更
     * PUT /api/v1/users/me/password
     */
    @PutMapping("/password")
    public ResponseEntity<Void> updatePassword(
            @Valid @RequestBody UpdatePasswordRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        passwordService.updatePassword(
                email,
                request.getCurrentPassword(),
                request.getNewPassword(),
                request.getNewPasswordConfirm()
        );
        return ResponseEntity.ok().build();
    }

    /**
     * アカウント削除
     * DELETE /api/v1/users/me
     */
    @DeleteMapping
    public ResponseEntity<Void> deleteAccount(
            @Valid @RequestBody DeleteAccountRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        accountService.deleteAccount(email, request.getPassword());
        return ResponseEntity.noContent().build();
    }
}
