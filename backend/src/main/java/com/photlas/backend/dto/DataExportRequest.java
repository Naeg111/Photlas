package com.photlas.backend.dto;

import jakarta.validation.constraints.Size;

/**
 * Issue#108 §4.1: ユーザー向けデータエクスポートリクエスト DTO。
 *
 * <p>OAuth のみユーザーは password を省略 (null) 可能。パスワードは Photlas の
 * パスワード要件（Issue#21、8〜20 文字）に揃えて最大 20 文字。</p>
 */
public record DataExportRequest(
        @Size(max = 20, message = "Password is too long")
        String password
) {}
