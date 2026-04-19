package com.photlas.backend.util;

/**
 * Issue#81 Phase 2 - OAuth access_token 暗号化器（Red 段階のスケルトン）
 *
 * Round 12 / Q9 決定: AES-256-GCM で OAuth access_token を暗号化して DB に保存し、
 * 退会時の best-effort revoke で復号して利用する。
 *
 * Green 段階で javax.crypto.Cipher(AES/GCM/NoPadding) を用いた実装を追加する。
 */
public class OAuthTokenEncryptor {

    public OAuthTokenEncryptor(String base64Key) {
        throw new UnsupportedOperationException("Red 段階: 未実装");
    }

    public Encrypted encrypt(String plaintext) {
        throw new UnsupportedOperationException("Red 段階: 未実装");
    }

    public String decrypt(byte[] ciphertext, byte[] iv) {
        throw new UnsupportedOperationException("Red 段階: 未実装");
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
