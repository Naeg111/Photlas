package com.photlas.backend.dto;

import com.photlas.backend.validation.ValidDeleteAccountRequest;

/**
 * Issue#20: アカウント設定機能 - アカウント削除リクエスト
 * Issue#81 Phase 4a: OAuth のみユーザー対応のため {@code confirmationChecked} を追加、
 * {@code password} の {@code @NotNull} を除去。クラスレベル複合バリデーションは
 * {@link ValidDeleteAccountRequest} が current user の {@code password_hash} 有無に応じて分岐する。
 */
@ValidDeleteAccountRequest
public class DeleteAccountRequest {

    /**
     * 通常 / ハイブリッドユーザーの退会パスワード。OAuth のみユーザーでは null 必須。
     * バリデーションは {@code @ValidDeleteAccountRequest} が行う。
     */
    private String password;

    /**
     * OAuth のみユーザー（password_hash == null）向けの退会確認チェックボックス。
     * 通常 / ハイブリッドユーザーでは使用しない。
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
