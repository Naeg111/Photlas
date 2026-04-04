package com.photlas.backend.validation;

import com.photlas.backend.dto.ResetPasswordRequest;
import com.photlas.backend.dto.UpdatePasswordRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * パスワード一致バリデーション（@PasswordMatch）のテスト
 */
public class PasswordMatchTest {

    private Validator validator;

    @BeforeEach
    void setUp() {
        validator = Validation.buildDefaultValidatorFactory().getValidator();
    }

    @Test
    @DisplayName("ResetPasswordRequest: パスワード不一致でバリデーションエラー")
    void testResetPassword_Mismatch_HasViolation() {
        ResetPasswordRequest request = new ResetPasswordRequest("valid-token", "Password1", "Different1");

        Set<ConstraintViolation<ResetPasswordRequest>> violations = validator.validate(request);

        assertThat(violations).anyMatch(v -> v.getMessage().contains("パスワードが一致しません"));
    }

    @Test
    @DisplayName("ResetPasswordRequest: パスワード一致でバリデーションエラーなし")
    void testResetPassword_Match_NoViolation() {
        ResetPasswordRequest request = new ResetPasswordRequest("valid-token", "Password1", "Password1");

        Set<ConstraintViolation<ResetPasswordRequest>> violations = validator.validate(request);

        assertThat(violations).noneMatch(v -> v.getMessage().contains("パスワードが一致しません"));
    }

    @Test
    @DisplayName("UpdatePasswordRequest: パスワード不一致でバリデーションエラー")
    void testUpdatePassword_Mismatch_HasViolation() {
        UpdatePasswordRequest request = new UpdatePasswordRequest("CurrentPass1", "NewPassword1", "Different1");

        Set<ConstraintViolation<UpdatePasswordRequest>> violations = validator.validate(request);

        assertThat(violations).anyMatch(v -> v.getMessage().contains("パスワードが一致しません"));
    }

    @Test
    @DisplayName("UpdatePasswordRequest: パスワード一致でバリデーションエラーなし")
    void testUpdatePassword_Match_NoViolation() {
        UpdatePasswordRequest request = new UpdatePasswordRequest("CurrentPass1", "NewPassword1", "NewPassword1");

        Set<ConstraintViolation<UpdatePasswordRequest>> violations = validator.validate(request);

        assertThat(violations).noneMatch(v -> v.getMessage().contains("パスワードが一致しません"));
    }
}
