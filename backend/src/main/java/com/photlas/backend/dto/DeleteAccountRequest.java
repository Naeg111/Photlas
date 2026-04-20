package com.photlas.backend.dto;

import jakarta.validation.constraints.*;

/**
 * Issue#20: アカウント設定機能 - アカウント削除リクエスト
 * Issue#81 Phase 4a: OAuth のみユーザー対応のため {@code confirmationChecked} を追加。
 * クラスレベルの妥当性は {@code @ValidDeleteAccountRequest}（Green 段階で付与）に委ねる。
 */
public class DeleteAccountRequest {
    @NotNull(message = "パスワードは必須です")
    private String password;

    /**
     * OAuth のみユーザー（password_hash == null）向けの退会確認チェックボックス。
     * 通常/ハイブリッドユーザーでは使用しない。
     */
    private Boolean confirmationChecked;

    public DeleteAccountRequest() {}

    public DeleteAccountRequest(String password) {
        this.password = password;
    }

    // Getters and Setters
    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Boolean getConfirmationChecked() {
        return confirmationChecked;
    }

    public void setConfirmationChecked(Boolean confirmationChecked) {
        this.confirmationChecked = confirmationChecked;
    }
}
