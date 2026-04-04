package com.photlas.backend.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import org.springframework.beans.BeanWrapperImpl;

/**
 * @PasswordMatchアノテーションのバリデーター実装
 * 指定された2つのフィールドの値が一致するかを検証する。
 */
public class PasswordMatchValidator implements ConstraintValidator<PasswordMatch, Object> {

    private String passwordField;
    private String confirmField;

    @Override
    public void initialize(PasswordMatch annotation) {
        this.passwordField = annotation.passwordField();
        this.confirmField = annotation.confirmField();
    }

    @Override
    public boolean isValid(Object obj, ConstraintValidatorContext context) {
        Object password = new BeanWrapperImpl(obj).getPropertyValue(passwordField);
        Object confirm = new BeanWrapperImpl(obj).getPropertyValue(confirmField);

        if (password == null || confirm == null) {
            return true; // null検証は@NotNull/@NotBlankに委ねる
        }

        return password.equals(confirm);
    }
}
