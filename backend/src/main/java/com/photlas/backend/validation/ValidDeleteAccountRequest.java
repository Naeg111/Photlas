package com.photlas.backend.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Issue#81 Phase 4a - 退会リクエストのクラスレベル複合バリデーション。
 *
 * <p>通常ユーザー (password_hash != null): {@code password} 必須（空文字不可）、
 * {@code confirmationChecked} は不問。
 *
 * <p>OAuth のみユーザー (password_hash == null): {@code password} は null 必須
 * （送信された場合はエラー）、{@code confirmationChecked == true} が必須。
 *
 * <p>判定は {@link DeleteAccountRequestValidator} が SecurityContext 経由で
 * current user を解決して行う。
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = DeleteAccountRequestValidator.class)
public @interface ValidDeleteAccountRequest {
    String message() default "退会リクエストが不正です";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
