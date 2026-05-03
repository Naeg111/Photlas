package com.photlas.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Issue#81 Phase 4h - OAuth のみユーザーの初回パスワード設定リクエスト。
 *
 * <p>{@code POST /api/v1/auth/oauth2/set-password} へ送信する。
 */
public class SetInitialPasswordRequest {

    @NotBlank(message = "パスワードは必須です")
    @Size(min = 8, max = 20, message = "パスワードは 8 文字以上 20 文字以内で入力してください")
    private String password;

    public SetInitialPasswordRequest() {}

    public SetInitialPasswordRequest(String password) {
        this.password = password;
    }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
