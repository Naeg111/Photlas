package com.photlas.backend.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Issue#81 Phase 4g - OAuth アカウントリンク確認リクエスト（Q1）。
 *
 * <p>{@code POST /api/v1/auth/oauth2/confirm-link} へ送信する。token は
 * OAuth ログイン失敗時のフラグメント経由で受け取った生トークン（hex 64 文字）。
 */
public class ConfirmLinkRequest {

    @NotBlank(message = "token は必須です")
    private String token;

    public ConfirmLinkRequest() {}

    public ConfirmLinkRequest(String token) {
        this.token = token;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
}
