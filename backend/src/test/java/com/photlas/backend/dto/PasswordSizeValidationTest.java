package com.photlas.backend.dto;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * パスワード関連 DTO のサイズ上限（max=20）バリデーションを統一的に検証するテスト。
 *
 * <p>Photlas のパスワード要件は 8〜20 文字（Issue#21）。本テストは「すべてのパスワード
 * フィールドが 21 文字以上を拒否する」ことを保証する。フィールドごとに DTO 単体で
 * Validator を呼び出し、HTTP 層・DB 層なしで直接検証する。</p>
 *
 * <p>背景: Issue#108 完了後の調査で、複数の DTO に max 上限が抜けていることが判明。
 * 統一して max=20 を付与する。</p>
 */
@SpringBootTest
@ActiveProfiles("test")
class PasswordSizeValidationTest {

    @Autowired
    private Validator validator;

    private static final String PASSWORD_21_CHARS = "Aaaaaaaaaaaaaaaaaaaa1"; // 数字・大文字・小文字を含む 21 文字

    @Test
    @DisplayName("LoginRequest.password は 21 文字以上で違反となる")
    void loginRequestRejects21CharPassword() {
        LoginRequest req = new LoginRequest("user@example.com", PASSWORD_21_CHARS);
        Set<ConstraintViolation<LoginRequest>> violations = validator.validate(req);
        assertViolatesField(violations, "password");
    }

    @Test
    @DisplayName("UpdatePasswordRequest.currentPassword は 21 文字以上で違反となる")
    void updatePasswordRequestRejects21CharCurrentPassword() {
        UpdatePasswordRequest req = new UpdatePasswordRequest(PASSWORD_21_CHARS, "ValidPass1", "ValidPass1");
        Set<ConstraintViolation<UpdatePasswordRequest>> violations = validator.validate(req);
        assertViolatesField(violations, "currentPassword");
    }

    @Test
    @DisplayName("UpdatePasswordRequest.newPasswordConfirm は 21 文字以上で違反となる")
    void updatePasswordRequestRejects21CharNewPasswordConfirm() {
        UpdatePasswordRequest req = new UpdatePasswordRequest("OldPass1", "NewPass1", PASSWORD_21_CHARS);
        Set<ConstraintViolation<UpdatePasswordRequest>> violations = validator.validate(req);
        assertViolatesField(violations, "newPasswordConfirm");
    }

    @Test
    @DisplayName("DeleteAccountRequest.password は 21 文字以上で違反となる")
    void deleteAccountRequestRejects21CharPassword() {
        DeleteAccountRequest req = new DeleteAccountRequest(PASSWORD_21_CHARS);
        Set<ConstraintViolation<DeleteAccountRequest>> violations = validator.validate(req);
        assertViolatesField(violations, "password");
    }

    @Test
    @DisplayName("ResetPasswordRequest.confirmPassword は 21 文字以上で違反となる")
    void resetPasswordRequestRejects21CharConfirmPassword() {
        ResetPasswordRequest req = new ResetPasswordRequest("token", "NewPass1", PASSWORD_21_CHARS);
        Set<ConstraintViolation<ResetPasswordRequest>> violations = validator.validate(req);
        assertViolatesField(violations, "confirmPassword");
    }

    @Test
    @DisplayName("SetInitialPasswordRequest.password は 21 文字以上で違反となる")
    void setInitialPasswordRequestRejects21CharPassword() {
        SetInitialPasswordRequest req = new SetInitialPasswordRequest(PASSWORD_21_CHARS);
        Set<ConstraintViolation<SetInitialPasswordRequest>> violations = validator.validate(req);
        assertViolatesField(violations, "password");
    }

    @Test
    @DisplayName("DataExportRequest.password は 21 文字以上で違反となる（max=100→20 へ厳格化）")
    void dataExportRequestRejects21CharPassword() {
        DataExportRequest req = new DataExportRequest(PASSWORD_21_CHARS);
        Set<ConstraintViolation<DataExportRequest>> violations = validator.validate(req);
        assertViolatesField(violations, "password");
    }

    @Test
    @DisplayName("20 文字パスワードはどの DTO でも違反にならない（境界値テスト）")
    void exactly20CharsIsAccepted() {
        String pw20 = "Aaaaaaaaaaaaaaaaaaa1"; // 数字・大文字・小文字を含む 20 文字

        // password 単独で違反が出ないことだけを確認
        // （他のフィールドの違反はテスト対象外）
        assertThat(violationFieldsOf(validator.validate(new LoginRequest("u@e.com", pw20))))
                .doesNotContain("password");
        assertThat(violationFieldsOf(validator.validate(new DeleteAccountRequest(pw20))))
                .doesNotContain("password");
        assertThat(violationFieldsOf(validator.validate(new SetInitialPasswordRequest(pw20))))
                .doesNotContain("password");
        assertThat(violationFieldsOf(validator.validate(new DataExportRequest(pw20))))
                .doesNotContain("password");
    }

    /** 指定フィールドに対する違反が少なくとも 1 件あることを確認する */
    private static <T> void assertViolatesField(Set<ConstraintViolation<T>> violations, String fieldName) {
        assertThat(violationFieldsOf(violations))
                .as("expected violation on field '%s', got: %s", fieldName, violations)
                .contains(fieldName);
    }

    private static <T> Set<String> violationFieldsOf(Set<ConstraintViolation<T>> violations) {
        return violations.stream()
                .map(v -> v.getPropertyPath().toString())
                .collect(Collectors.toSet());
    }
}
