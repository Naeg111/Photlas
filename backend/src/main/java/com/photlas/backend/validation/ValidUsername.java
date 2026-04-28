package com.photlas.backend.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 表示名バリデーション用のカスタム Bean Validation アノテーション。
 * Issue#98: 表示名バリデーション強化。
 *
 * <p>使用例:
 * <pre>
 * public class RegisterRequest {
 *     {@literal @}ValidUsername
 *     private String username;
 * }
 * </pre>
 *
 * <p>違反時のメッセージは {@code errors.USERNAME_*} 形式の i18n キー文字列が
 * {@link UsernameConstraintValidator} により動的に設定される。
 */
@Documented
@Constraint(validatedBy = UsernameConstraintValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidUsername {
    /** 既定メッセージ（通常は ConstraintValidator が動的に上書きする） */
    String message() default "errors.USERNAME_INVALID";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
