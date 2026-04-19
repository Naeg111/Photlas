package com.photlas.backend.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Issue#81 Phase 2 - OAuthProvider 列挙型のテスト
 *
 * 数値コード: 1401=GOOGLE, 1402=LINE（CodeConstants 衝突回避のため 1400 番台を採択）
 */
class OAuthProviderTest {

    @Nested
    @DisplayName("数値コード定義")
    class NumericCodes {

        @Test
        @DisplayName("Issue#81 - GOOGLE のコードが 1401 である")
        void googleCodeIs1401() {
            assertThat(OAuthProvider.GOOGLE.getCode()).isEqualTo(1401);
        }

        @Test
        @DisplayName("Issue#81 - LINE のコードが 1402 である")
        void lineCodeIs1402() {
            assertThat(OAuthProvider.LINE.getCode()).isEqualTo(1402);
        }

        @Test
        @DisplayName("Issue#81 - 全 enum 値が 1400 番台に収まる（CodeConstants 他フィールドとの衝突回避）")
        void allCodesAreInRange1400to1499() {
            for (OAuthProvider provider : OAuthProvider.values()) {
                assertThat(provider.getCode())
                        .as("provider %s", provider.name())
                        .isBetween(1400, 1499);
            }
        }

        @Test
        @DisplayName("Issue#81 - 全 enum 値のコードに重複がない")
        void allCodesAreUnique() {
            long distinct = java.util.Arrays.stream(OAuthProvider.values())
                    .mapToInt(OAuthProvider::getCode)
                    .distinct()
                    .count();
            assertThat(distinct).isEqualTo(OAuthProvider.values().length);
        }
    }

    @Nested
    @DisplayName("コード ⇄ enum 相互変換")
    class CodeConversion {

        @Test
        @DisplayName("Issue#81 - 1401 から GOOGLE を取得できる")
        void fromCode1401ReturnsGoogle() {
            assertThat(OAuthProvider.fromCode(1401)).isEqualTo(OAuthProvider.GOOGLE);
        }

        @Test
        @DisplayName("Issue#81 - 1402 から LINE を取得できる")
        void fromCode1402ReturnsLine() {
            assertThat(OAuthProvider.fromCode(1402)).isEqualTo(OAuthProvider.LINE);
        }

        @Test
        @DisplayName("Issue#81 - 未定義コードは IllegalArgumentException を投げる")
        void fromUnknownCodeThrows() {
            assertThatThrownBy(() -> OAuthProvider.fromCode(9999))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("9999");
        }
    }

    @Nested
    @DisplayName("Spring Security registrationId との対応")
    class RegistrationIdMapping {

        @Test
        @DisplayName("Issue#81 - GOOGLE の registrationId が \"google\" である")
        void googleRegistrationId() {
            assertThat(OAuthProvider.GOOGLE.getRegistrationId()).isEqualTo("google");
        }

        @Test
        @DisplayName("Issue#81 - LINE の registrationId が \"line\" である")
        void lineRegistrationId() {
            assertThat(OAuthProvider.LINE.getRegistrationId()).isEqualTo("line");
        }

        @Test
        @DisplayName("Issue#81 - registrationId から enum を逆引きできる")
        void fromRegistrationIdLookup() {
            assertThat(OAuthProvider.fromRegistrationId("google")).isEqualTo(OAuthProvider.GOOGLE);
            assertThat(OAuthProvider.fromRegistrationId("line")).isEqualTo(OAuthProvider.LINE);
        }

        @Test
        @DisplayName("Issue#81 - 未知の registrationId は IllegalArgumentException を投げる")
        void fromUnknownRegistrationIdThrows() {
            assertThatThrownBy(() -> OAuthProvider.fromRegistrationId("facebook"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("facebook");
        }
    }
}
