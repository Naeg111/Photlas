package com.photlas.backend.validation;

import com.photlas.backend.entity.ReportReason;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Issue#19: ReportReasonの値を検証するバリデーター
 */
public class ReportReasonValidator implements ConstraintValidator<ValidReportReason, String> {

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) {
            return false;
        }

        try {
            ReportReason.valueOf(value);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}
