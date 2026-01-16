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
     * トークンからユーザー名（email）を抽出
     *
     * @param token JWTトークン
     * @return ユーザー名（email）
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
     * ユーザー名からJWTトークンを生成
     *
     * @param username ユーザー名（email）
     * @return 生成されたJWTトークン
     */
    public String generateToken(String username) {
        return generateToken(new HashMap<>(), username);
    }

    /**
     * ユーザー名と追加クレームからJWTトークンを生成
     *
     * @param extraClaims 追加クレーム
     * @param username ユーザー名（email）
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
     * @param username ユーザー名（email）
     * @return トークンが有効でユーザー名が一致する場合true
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