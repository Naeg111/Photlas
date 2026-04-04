package com.photlas.backend.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TokenGeneratorのテスト
 */
public class TokenGeneratorTest {

    @Test
    @DisplayName("生成されたトークンはURLセーフな文字のみで構成される")
    void testGenerateSecureToken_IsUrlSafe() {
        String token = TokenGenerator.generateSecureToken();
        assertTrue(token.matches("^[a-zA-Z0-9\\-_]+$"),
                "トークンはURLセーフな文字（英数字、ハイフン、アンダースコア）のみ");
    }

    @Test
    @DisplayName("生成されたトークンは十分な長さがある（32文字以上）")
    void testGenerateSecureToken_HasSufficientLength() {
        String token = TokenGenerator.generateSecureToken();
        assertTrue(token.length() >= 32,
                "トークンは32文字以上: actual=" + token.length());
    }

    @Test
    @DisplayName("連続して生成されたトークンは全て異なる")
    void testGenerateSecureToken_IsUnique() {
        Set<String> tokens = new HashSet<>();
        for (int i = 0; i < 100; i++) {
            tokens.add(TokenGenerator.generateSecureToken());
        }
        assertEquals(100, tokens.size(), "100個のトークンが全て異なる");
    }
}
