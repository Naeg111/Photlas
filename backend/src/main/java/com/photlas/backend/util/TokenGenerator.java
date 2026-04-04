package com.photlas.backend.util;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * 安全なトークン生成ユーティリティ
 * メール認証トークンやパスワードリセットトークンの生成に使用する。
 * 暗号学的に安全な乱数生成器（SecureRandom）で直接バイト列を生成する。
 */
public final class TokenGenerator {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int TOKEN_BYTE_LENGTH = 32;

    private TokenGenerator() {}

    /**
     * 暗号学的に安全なランダムトークンを生成する
     *
     * @return URLセーフなBase64エンコードされたトークン（43文字）
     */
    public static String generateSecureToken() {
        byte[] bytes = new byte[TOKEN_BYTE_LENGTH];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
