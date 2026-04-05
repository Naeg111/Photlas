package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * JwtService ユニットテスト
 * Issue#23: JWT Secretの環境変数化対応
 * Issue#54: ロール情報付きトークン
 */
public class JwtServiceTest {

    private JwtService jwtService;

    private static final String TEST_SECRET = "test-secret-key-must-be-at-least-32-bytes-long!!";
    private static final int TEST_EXPIRATION = 86400000; // 24時間
    private static final String TEST_USERNAME = "test@example.com";

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        setField(jwtService, "secret", TEST_SECRET);
        setField(jwtService, "jwtExpiration", TEST_EXPIRATION);
    }

    @Test
    @DisplayName("generateToken - ユーザー名からトークンを生成できる")
    void generateToken_returnsNonNullToken() {
        String token = jwtService.generateToken(TEST_USERNAME);

        assertNotNull(token);
        assertTrue(token.startsWith("eyJ")); // JWT形式確認
    }

    @Test
    @DisplayName("extractUsername - トークンからユーザー名を正しく抽出できる")
    void extractUsername_returnsCorrectUsername() {
        String token = jwtService.generateToken(TEST_USERNAME);

        String username = jwtService.extractUsername(token);

        assertEquals(TEST_USERNAME, username);
    }

    @Test
    @DisplayName("generateTokenWithRole - ロール情報付きトークンを生成できる")
    void generateTokenWithRole_embedsRole() {
        String token = jwtService.generateTokenWithRole(TEST_USERNAME, "ADMIN");

        assertNotNull(token);
        String role = jwtService.extractRole(token);
        assertEquals("ADMIN", role);
    }

    @Test
    @DisplayName("extractRole - ロールなしトークンからはnullを返す")
    void extractRole_noRoleClaim_returnsNull() {
        String token = jwtService.generateToken(TEST_USERNAME);

        String role = jwtService.extractRole(token);

        assertNull(role);
    }

    @Test
    @DisplayName("isTokenValid - 有効なトークンとユーザー名でtrueを返す")
    void isTokenValid_validTokenAndUsername_returnsTrue() {
        String token = jwtService.generateToken(TEST_USERNAME);

        assertTrue(jwtService.isTokenValid(token, TEST_USERNAME));
    }

    @Test
    @DisplayName("isTokenValid - ユーザー名不一致でfalseを返す")
    void isTokenValid_wrongUsername_returnsFalse() {
        String token = jwtService.generateToken(TEST_USERNAME);

        assertFalse(jwtService.isTokenValid(token, "other@example.com"));
    }

    @Test
    @DisplayName("isTokenValid - 期限切れトークンで例外がスローされる")
    void isTokenValid_expiredToken_throwsException() {
        // 有効期限を-1秒に設定して期限切れトークンを生成
        setField(jwtService, "jwtExpiration", -1000);
        String expiredToken = jwtService.generateToken(TEST_USERNAME);

        assertThrows(ExpiredJwtException.class, () -> {
            jwtService.isTokenValid(expiredToken, TEST_USERNAME);
        });
    }

    @Test
    @DisplayName("getExpirationTime - 設定された有効期限を返す")
    void getExpirationTime_returnsConfiguredValue() {
        assertEquals(TEST_EXPIRATION, jwtService.getExpirationTime());
    }

    @Test
    @DisplayName("generateToken(Map, String) - 追加クレームが含まれたトークンを生成できる")
    void generateToken_withExtraClaims_includesClaims() {
        java.util.Map<String, Object> claims = new java.util.HashMap<>();
        claims.put("custom_key", "custom_value");
        String token = jwtService.generateToken(claims, TEST_USERNAME);

        String value = jwtService.extractClaim(token, c -> c.get("custom_key", String.class));
        assertEquals("custom_value", value);
    }

    @Test
    @DisplayName("extractClaim - 有効期限クレームを抽出できる")
    void extractClaim_extractsExpiration() {
        String token = jwtService.generateToken(TEST_USERNAME);

        java.util.Date expiration = jwtService.extractClaim(token, Claims::getExpiration);

        assertNotNull(expiration);
        assertTrue(expiration.after(new java.util.Date()));
    }

    @Test
    @DisplayName("異なる秘密鍵で署名されたトークンの検証で例外がスローされる")
    void extractUsername_differentKey_throwsException() {
        String token = jwtService.generateToken(TEST_USERNAME);

        // 異なる秘密鍵で新しいJwtServiceを作成
        JwtService otherService = new JwtService();
        setField(otherService, "secret", "different-secret-key-must-be-at-least-32-bytes!!");
        setField(otherService, "jwtExpiration", TEST_EXPIRATION);

        assertThrows(Exception.class, () -> {
            otherService.extractUsername(token);
        });
    }

    /**
     * リフレクションでprivateフィールドに値を設定するヘルパー
     */
    private void setField(Object target, String fieldName, Object value) {
        try {
            java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
