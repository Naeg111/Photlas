package com.photlas.backend.dto;

import jakarta.validation.constraints.Size;

/**
 * Issue#108 §4.1: ユーザー向けデータエクスポートリクエスト DTO。
 *
 * <p>OAuth のみユーザーは password を省略 (null) 可能。パスワードは最大 100 文字
 * （DoS 防止）。Issue#21 のパスワード要件は 8〜20 文字なので 100 字あれば十分なバッファ。</p>
 */
public record DataExportRequest(
        @Size(max = 100, message = "Password is too long")
        String password
) {}
