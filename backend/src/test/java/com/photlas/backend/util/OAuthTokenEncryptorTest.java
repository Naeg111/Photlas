package com.photlas.backend.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.security.SecureRandom;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Issue#81 Phase 2 - OAuthTokenEncryptor（AES-256-GCM）のテスト
 *
 * Round 12 / Q9 決定: OAuth access_token を AES-256-GCM で暗号化して DB に保存し、
 * 退会時の revoke で復号して送信する。
 *
 * 要件:
 *   - 256bit 鍵で暗号化・復号のラウンドトリップが成功する
 *   - 同じ平文でも IV が異なれば ciphertext が異なる（確率的暗号化）
 *   - 鍵不一致なら復号に失敗する（AEADBadTagException）
 *   - null 入力は null を返す（NPE を投げない）
 *   - 鍵は Base64 エンコードされた 32 バイト（256bit）を前提とする
 */
class OAuthTokenEncryptorTest {

    /** テスト用の 256bit 鍵（Base64 エンコード、32 バイト） */
    private static final String TEST_KEY_BASE64 = base64OfRandomBytes(32);
    private static final String OTHER_KEY_BASE64 = base64OfRandomBytes(32);

    private static String base64OfRandomBytes(int length) {
        byte[] bytes = new byte[length];
        new SecureRandom().nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    @Nested
    @DisplayName("暗号化・復号のラウンドトリップ")
    class RoundTrip {

        @Test
        @DisplayName("Issue#81 - 平文を暗号化後、同じ鍵で復号すれば元の文字列に戻る")
        void encryptDecryptRoundTrip() {
            OAuthTokenEncryptor encryptor = new OAuthTokenEncryptor(TEST_KEY_BASE64);
            String plaintext = "ya29.a0AfH6SMBx-dummy-google-access-token";

            OAuthTokenEncryptor.Encrypted encrypted = encryptor.encrypt(plaintext);
            String decrypted = encryptor.decrypt(encrypted.ciphertext(), encrypted.iv());

            assertThat(decrypted).isEqualTo(plaintext);
        }

        @Test
        @DisplayName("Issue#81 - 長い access_token（2048 文字程度）でもラウンドトリップ可能")
        void encryptDecryptLongToken() {
            OAuthTokenEncryptor encryptor = new OAuthTokenEncryptor(TEST_KEY_BASE64);
            String plaintext = "a".repeat(2048);

            OAuthTokenEncryptor.Encrypted encrypted = encryptor.encrypt(plaintext);
            String decrypted = encryptor.decrypt(encrypted.ciphertext(), encrypted.iv());

            assertThat(decrypted).isEqualTo(plaintext);
        }

        @Test
        @DisplayName("Issue#81 - マルチバイト文字列（日本語）でもラウンドトリップ可能")
        void encryptDecryptMultibyte() {
            OAuthTokenEncryptor encryptor = new OAuthTokenEncryptor(TEST_KEY_BASE64);
            String plaintext = "テスト用トークン🔐日本語";

            OAuthTokenEncryptor.Encrypted encrypted = encryptor.encrypt(plaintext);
            String decrypted = encryptor.decrypt(encrypted.ciphertext(), encrypted.iv());

            assertThat(decrypted).isEqualTo(plaintext);
        }
    }

    @Nested
    @DisplayName("IV の独立性")
    class IvIndependence {

        @Test
        @DisplayName("Issue#81 - 同じ平文・同じ鍵でも、呼び出すたびに IV が異なり ciphertext も異なる")
        void sameTextDifferentCiphertext() {
            OAuthTokenEncryptor encryptor = new OAuthTokenEncryptor(TEST_KEY_BASE64);
            String plaintext = "same-plaintext";

            OAuthTokenEncryptor.Encrypted first = encryptor.encrypt(plaintext);
            OAuthTokenEncryptor.Encrypted second = encryptor.encrypt(plaintext);

            assertThat(first.iv()).isNotEqualTo(second.iv());
            assertThat(first.ciphertext()).isNotEqualTo(second.ciphertext());
        }

        @Test
        @DisplayName("Issue#81 - IV は 12 バイト（GCM 標準長）")
        void ivIs12Bytes() {
            OAuthTokenEncryptor encryptor = new OAuthTokenEncryptor(TEST_KEY_BASE64);
            OAuthTokenEncryptor.Encrypted encrypted = encryptor.encrypt("test");

            assertThat(encrypted.iv()).hasSize(12);
        }
    }

    @Nested
    @DisplayName("鍵不一致")
    class KeyMismatch {

        @Test
        @DisplayName("Issue#81 - 異なる鍵で復号すると例外を投げる（AEAD の改ざん検知）")
        void differentKeyFailsDecryption() {
            OAuthTokenEncryptor encryptor = new OAuthTokenEncryptor(TEST_KEY_BASE64);
            OAuthTokenEncryptor.Encrypted encrypted = encryptor.encrypt("secret-token");

            OAuthTokenEncryptor otherEncryptor = new OAuthTokenEncryptor(OTHER_KEY_BASE64);

            assertThatThrownBy(() -> otherEncryptor.decrypt(encrypted.ciphertext(), encrypted.iv()))
                    .isInstanceOf(OAuthTokenEncryptor.DecryptionException.class);
        }

        @Test
        @DisplayName("Issue#81 - ciphertext を改ざんすると復号に失敗する")
        void tamperedCiphertextFailsDecryption() {
            OAuthTokenEncryptor encryptor = new OAuthTokenEncryptor(TEST_KEY_BASE64);
            OAuthTokenEncryptor.Encrypted encrypted = encryptor.encrypt("secret-token");
            byte[] tampered = encrypted.ciphertext().clone();
            tampered[0] ^= (byte) 0xFF;

            assertThatThrownBy(() -> encryptor.decrypt(tampered, encrypted.iv()))
                    .isInstanceOf(OAuthTokenEncryptor.DecryptionException.class);
        }
    }

    @Nested
    @DisplayName("null / 空文字の扱い")
    class NullHandling {

        @Test
        @DisplayName("Issue#81 - null 平文の暗号化は null を返す")
        void nullPlaintextReturnsNull() {
            OAuthTokenEncryptor encryptor = new OAuthTokenEncryptor(TEST_KEY_BASE64);
            assertThat(encryptor.encrypt(null)).isNull();
        }

        @Test
        @DisplayName("Issue#81 - null ciphertext の復号は null を返す")
        void nullCiphertextReturnsNull() {
            OAuthTokenEncryptor encryptor = new OAuthTokenEncryptor(TEST_KEY_BASE64);
            assertThat(encryptor.decrypt(null, new byte[12])).isNull();
        }

        @Test
        @DisplayName("Issue#81 - null IV の復号は null を返す")
        void nullIvReturnsNull() {
            OAuthTokenEncryptor encryptor = new OAuthTokenEncryptor(TEST_KEY_BASE64);
            assertThat(encryptor.decrypt(new byte[16], null)).isNull();
        }
    }

    @Nested
    @DisplayName("鍵のバリデーション")
    class KeyValidation {

        @Test
        @DisplayName("Issue#81 - 鍵が Base64 として不正なら IllegalArgumentException を投げる")
        void invalidBase64KeyThrows() {
            assertThatThrownBy(() -> new OAuthTokenEncryptor("not-valid-base64!!!"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("Issue#81 - 鍵が 32 バイト未満なら IllegalArgumentException を投げる")
        void shortKeyThrows() {
            String shortKey = base64OfRandomBytes(16);
            assertThatThrownBy(() -> new OAuthTokenEncryptor(shortKey))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("32");
        }

        @Test
        @DisplayName("Issue#81 - 鍵が null または空文字なら IllegalArgumentException を投げる")
        void nullOrEmptyKeyThrows() {
            assertThatThrownBy(() -> new OAuthTokenEncryptor(null))
                    .isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> new OAuthTokenEncryptor(""))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
