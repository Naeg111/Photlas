package com.photlas.backend.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

/**
 * JWT認証サービス
 * Issue#23: JWT Secretの環境変数化対応
 */
@Service
public class JwtService {

    /**
     * JWT署名用秘密鍵
     * Issue#23: デフォルト値なし（application.propertiesまたは環境変数から必須取得）
     */
    @Value("${jwt.secret}")
    private String secret;

    /**
     * JWTトークン有効期限（ミリ秒）
     * デフォルト: 86400000ms = 24時間
     */
    @Value("${jwt.expiration:86400000}")
    private int jwtExpiration;

    /**
     * トークンから表示名（email）を抽出
     *
     * @param token JWTトークン
     * @return 表示名（email）
     */
    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    /**
     * トークンから特定のクレームを抽出
     *
     * @param token JWTトークン
     * @param claimsResolver クレーム解決関数
     * @param <T> クレームの型
     * @return 抽出されたクレーム
     */
    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    /**
     * 表示名からJWTトークンを生成
     *
     * @param username 表示名（email）
     * @return 生成されたJWTトークン
     */
    public String generateToken(String username) {
        return generateToken(new HashMap<>(), username);
    }

    /**
     * Issue#54: 表示名とロール情報からJWTトークンを生成
     *
     * @param username 表示名（email）
     * @param role ユーザーロール（USER, ADMIN）
     * @return 生成されたJWTトークン
     */
    public String generateTokenWithRole(String username, String role) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", role);
        return generateToken(claims, username);
    }

    /**
     * Issue#54: トークンからロール情報を抽出
     *
     * @param token JWTトークン
     * @return ロール文字列（存在しない場合は"USER"）
     */
    public String extractRole(String token) {
        try {
            return extractClaim(token, claims -> claims.get("role", String.class));
        } catch (Exception e) {
            return "USER";
        }
    }

    /**
     * 表示名と追加クレームからJWTトークンを生成
     *
     * @param extraClaims 追加クレーム
     * @param username 表示名（email）
     * @return 生成されたJWTトークン
     */
    public String generateToken(Map<String, Object> extraClaims, String username) {
        return buildToken(extraClaims, username, jwtExpiration);
    }

    /**
     * トークンの有効期限を取得
     *
     * @return 有効期限（ミリ秒）
     */
    public long getExpirationTime() {
        return jwtExpiration;
    }

    private String buildToken(
            Map<String, Object> extraClaims,
            String username,
            long expiration
    ) {
        return Jwts
                .builder()
                .claims(extraClaims)
                .subject(username)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSignInKey(), Jwts.SIG.HS256)
                .compact();
    }

    /**
     * トークンの有効性を検証
     *
     * @param token JWTトークン
     * @param username 表示名（email）
     * @return トークンが有効で表示名が一致する場合true
     */
    public boolean isTokenValid(String token, String username) {
        final String tokenUsername = extractUsername(token);
        return (tokenUsername.equals(username)) && !isTokenExpired(token);
    }

    private boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    private Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    private Claims extractAllClaims(String token) {
        return Jwts
                .parser()
                .verifyWith(getSignInKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private SecretKey getSignInKey() {
        byte[] keyBytes = secret.getBytes();
        return Keys.hmacShaKeyFor(keyBytes);
    }
}