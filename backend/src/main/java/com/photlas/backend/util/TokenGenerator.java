package com.photlas.backend.util;

import java.util.Base64;
import java.util.UUID;

/**
 * 安全なトークン生成ユーティリティ
 * メール認証トークンやパスワードリセットトークンの生成に使用する。
 */
public final class TokenGenerator {

    private TokenGenerator() {}

    /**
     * UUIDをBase64エンコードして推測困難なトークンを生成
     *
     * @return 生成されたトークン
     */
    public static String generateSecureToken() {
        String uuid = UUID.randomUUID().toString() + UUID.randomUUID().toString();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(uuid.getBytes());
    }
}
