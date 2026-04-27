package com.photlas.backend.validation;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * UsernameConstraintValidator のテスト。
 * Issue#98 4.4.1: Bean Validation 統合の確認。
 *
 * <p>{@code @ValidUsername} アノテーションが付与されたフィールドに対し、
 * 違反時に i18n キー（{@code errors.USERNAME_*}）がメッセージとして
 * 設定されることを検証する。
 */
class UsernameConstraintValidatorTest {

    private ValidatorFactory factory;
    private Validator validator;

    /**
     * テスト用の DTO（クラスレベル定義）。
     */
    static class UsernameHolder {
        @ValidUsername
        private final String username;

        UsernameHolder(String username) {
            this.username = username;
        }

        public String getUsername() {
            return username;
        }
    }

    @BeforeEach
    void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterEach
    void tearDown() {
        if (factory != null) {
            factory.close();
        }
    }

    private void assertViolation(String username, String expectedI18nKey) {
        Set<ConstraintViolation<UsernameHolder>> violations = validator.validate(new UsernameHolder(username));
        assertEquals(1, violations.size(), "expected exactly one violation for: " + username);
        ConstraintViolation<UsernameHolder> v = violations.iterator().next();
        assertEquals(expectedI18nKey, v.getMessage(),
                "i18n key mismatch for input: " + username);
    }

    private void assertNoViolation(String username) {
        Set<ConstraintViolation<UsernameHolder>> violations = validator.validate(new UsernameHolder(username));
        assertTrue(violations.isEmpty(),
                "expected no violations for: " + username + ", got: " + violations);
    }

    @Test
    @DisplayName("Issue#98 - null は errors.USERNAME_REQUIRED")
    void null_returns_required_i18n_key() {
        assertViolation(null, "errors.USERNAME_REQUIRED");
    }

    @Test
    @DisplayName("Issue#98 - 1文字は errors.USERNAME_LENGTH_INVALID")
    void short_returns_length_invalid_i18n_key() {
        assertViolation("a", "errors.USERNAME_LENGTH_INVALID");
    }

    @Test
    @DisplayName("Issue#98 - 記号 @ は errors.USERNAME_INVALID_CHARACTER_SYMBOL")
    void symbol_returns_symbol_i18n_key() {
        assertViolation("abc@def", "errors.USERNAME_INVALID_CHARACTER_SYMBOL");
    }

    @Test
    @DisplayName("Issue#98 - admin は errors.USERNAME_RESERVED")
    void reserved_returns_reserved_i18n_key() {
        assertViolation("admin", "errors.USERNAME_RESERVED");
    }

    @Test
    @DisplayName("Issue#98 - tanaka は違反なし（通過）")
    void valid_username_no_violation() {
        assertNoViolation("tanaka");
    }
}
