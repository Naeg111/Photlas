package com.photlas.backend.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.*;

/**
 * パスワードと確認用パスワードの一致を検証するクラスレベルバリデーション
 *
 * @param passwordField パスワードフィールド名
 * @param confirmField 確認用パスワードフィールド名
 */
@Documented
@Constraint(validatedBy = PasswordMatchValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface PasswordMatch {
    String message() default "パスワードが一致しません";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};

    String passwordField();
    String confirmField();
}
