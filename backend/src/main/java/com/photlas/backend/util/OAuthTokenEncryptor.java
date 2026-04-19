package com.photlas.backend.util;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Issue#81 - OAuth access_token の AES-256-GCM 暗号化器。
 *
 * Round 12 / Q9 決定: OAuth access_token を DB に生で保存せず、AES-256-GCM で暗号化する。
 * 退会時の best-effort revoke で復号してプロバイダに送信する。
 *
 * 暗号化仕様:
 *   - アルゴリズム: AES/GCM/NoPadding
 *   - 鍵長: 256 bit（32 バイト、Base64 エンコード形式で外部から渡す）
 *   - IV: 12 バイト（GCM 標準）、暗号化のたびに SecureRandom で生成
 *   - 認証タグ長: 128 bit
 *   - IV は DB に別カラム（token_encrypted_iv）で保存し、復号時に ciphertext と対で利用
 */
public class OAuthTokenEncryptor {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int IV_LENGTH_BYTES = 12;
    private static final int KEY_LENGTH_BYTES = 32; // 256 bit

    private final SecretKeySpec keySpec;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * 256bit 鍵を Base64 文字列で受け取り、暗号化器を初期化する。
     *
     * @param base64Key Base64 エンコードされた 32 バイトの鍵
     * @throws IllegalArgumentException 鍵が null/空文字、Base64 として不正、または 32 バイト以外のとき
     */
    public OAuthTokenEncryptor(String base64Key) {
        if (base64Key == null || base64Key.isEmpty()) {
            throw new IllegalArgumentException("OAuth 暗号化鍵が設定されていません");
        }
        byte[] keyBytes;
        try {
            keyBytes = Base64.getDecoder().decode(base64Key);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("OAuth 暗号化鍵が Base64 として不正です", e);
        }
        if (keyBytes.length != KEY_LENGTH_BYTES) {
            throw new IllegalArgumentException(
                    "OAuth 暗号化鍵は 32 バイト（256bit）である必要があります。受信: " + keyBytes.length + " バイト");
        }
        this.keySpec = new SecretKeySpec(keyBytes, "AES");
    }

    /**
     * 平文を暗号化する。毎回新しい IV を生成する。
     *
     * @param plaintext 平文。null の場合は null を返す
     * @return ciphertext と IV のペア
     */
    public Encrypted encrypt(String plaintext) {
        if (plaintext == null) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_LENGTH_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return new Encrypted(ciphertext, iv);
        } catch (Exception e) {
            throw new IllegalStateException("OAuth トークンの暗号化に失敗しました", e);
        }
    }

    /**
     * ciphertext と IV から平文を復号する。
     * 鍵不一致・改ざん検知時は {@link DecryptionException} を投げる。
     *
     * @param ciphertext 暗号文。null の場合は null を返す
     * @param iv         IV（12 バイト）。null の場合は null を返す
     * @return 復号された平文
     * @throws DecryptionException 復号失敗（AEAD タグ不一致）時
     */
    public String decrypt(byte[] ciphertext, byte[] iv) {
        if (ciphertext == null || iv == null) {
            return null;
        }
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] plaintextBytes = cipher.doFinal(ciphertext);
            return new String(plaintextBytes, StandardCharsets.UTF_8);
        } catch (javax.crypto.AEADBadTagException e) {
            throw new DecryptionException("OAuth トークンの復号に失敗（AEAD タグ不一致 / 鍵不一致 / 改ざんの可能性）", e);
        } catch (Exception e) {
            throw new DecryptionException("OAuth トークンの復号に失敗", e);
        }
    }

    /**
     * 暗号化結果（ciphertext + IV のペア）。DB には両者を独立カラムに保存する。
     */
    public record Encrypted(byte[] ciphertext, byte[] iv) {}

    /**
     * 復号失敗（鍵不一致・改ざん検知）時の例外。
     */
    public static class DecryptionException extends RuntimeException {
        public DecryptionException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
