package com.photlas.backend.validation;

import com.photlas.backend.entity.CodeConstants;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.util.Set;

/**
 * Issue#19: 通報理由の数値コードを検証するバリデーター
 * Issue#87: 文字列Enum → 数値コードに変更
 */
public class ReportReasonValidator implements ConstraintValidator<ValidReportReason, Integer> {

    private static final Set<Integer> VALID_REASONS = Set.of(
            CodeConstants.REASON_ADULT_CONTENT,
            CodeConstants.REASON_VIOLENCE,
            CodeConstants.REASON_COPYRIGHT_INFRINGEMENT,
            CodeConstants.REASON_PRIVACY_VIOLATION,
            CodeConstants.REASON_SPAM,
            CodeConstants.REASON_OTHER
    );

    @Override
    public boolean isValid(Integer value, ConstraintValidatorContext context) {
        if (value == null) {
            return false;
        }
        return VALID_REASONS.contains(value);
    }
}
