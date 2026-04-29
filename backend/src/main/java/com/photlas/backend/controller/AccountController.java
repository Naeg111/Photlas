package com.photlas.backend.controller;

import com.photlas.backend.dto.DeleteAccountRequest;
import com.photlas.backend.dto.UpdateEmailRequest;
import com.photlas.backend.dto.UpdateLanguageRequest;
import com.photlas.backend.dto.UpdatePasswordRequest;
import com.photlas.backend.service.AccountService;
import com.photlas.backend.service.PasswordService;
import com.photlas.backend.service.ProfileService;
import com.photlas.backend.util.LanguageUtils;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * アカウント設定関連のエンドポイントを提供するコントローラー
 * 例外処理はGlobalExceptionHandlerに委譲する。
 */
@RestController
@RequestMapping("/api/v1/users/me")
public class AccountController {

    private final AccountService accountService;
    private final PasswordService passwordService;
    private final ProfileService profileService;

    public AccountController(AccountService accountService, PasswordService passwordService,
                             ProfileService profileService) {
        this.accountService = accountService;
        this.passwordService = passwordService;
        this.profileService = profileService;
    }

    /**
     * Issue#86: メールアドレス変更リクエスト
     * 即座に変更せず、新メールアドレスに確認リンクを送信する。
     * PUT /api/v1/users/me/email
     */
    @PutMapping("/email")
    public ResponseEntity<Map<String, String>> requestEmailChange(
            @Valid @RequestBody UpdateEmailRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        accountService.requestEmailChange(email, request.getNewEmail(), request.getCurrentPassword());
        return ResponseEntity.ok(Map.of("message", "確認メールを送信しました。新しいメールアドレスに届いたリンクをクリックして変更を完了してください。"));
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
                request.getNewPassword()
        );
        return ResponseEntity.ok().build();
    }

    /**
     * Issue#93: 言語設定変更
     * PUT /api/v1/users/me/language
     */
    @PutMapping("/language")
    public ResponseEntity<Void> updateLanguage(
            @Valid @RequestBody UpdateLanguageRequest request,
            Authentication authentication) {
        if (!LanguageUtils.isSupported(request.getLanguage())) {
            throw new IllegalArgumentException("未対応の言語コードです: " + request.getLanguage());
        }
        String email = authentication.getName();
        profileService.updateLanguage(email, request.getLanguage());
        return ResponseEntity.ok().build();
    }

    /**
     * アカウント削除
     * DELETE /api/v1/users/me
     *
     * <p>Issue#81 Phase 4b: confirmationChecked を含む 3 引数シグネチャに移行。
     * OAuth のみユーザー（password_hash == null）は password を送らず
     * {@code confirmationChecked == true} で削除する。クラスレベル
     * {@code @ValidDeleteAccountRequest} が事前にユーザー区分と整合性を検証。
     */
    @DeleteMapping
    public ResponseEntity<Void> deleteAccount(
            @Valid @RequestBody DeleteAccountRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        accountService.deleteAccount(
                email,
                request.getPassword(),
                Boolean.TRUE.equals(request.getConfirmationChecked())
        );
        return ResponseEntity.noContent().build();
    }

    /**
     * Issue#104: OAuth 経由の未同意ユーザーが利用規約同意ダイアログでキャンセルした場合、
     * アカウントを物理削除する。
     * DELETE /api/v1/users/me/cancel-registration
     *
     * <p>{@code terms_agreed_at IS NULL} のときのみ実行可能。NOT NULL の場合は 403 を返す。
     * 通常の退会処理 ({@link #deleteAccount}) は論理削除だが、こちらは未同意ユーザー専用で物理削除する。
     */
    @DeleteMapping("/cancel-registration")
    public ResponseEntity<Void> cancelRegistration(Authentication authentication) {
        String email = authentication.getName();
        accountService.cancelRegistration(email);
        return ResponseEntity.noContent().build();
    }
}
