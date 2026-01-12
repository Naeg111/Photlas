package com.photlas.backend.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

/**
 * Issue#19: ReportReasonの値を検証するアノテーション
 */
@Documented
@Constraint(validatedBy = ReportReasonValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidReportReason {
    String message() default "不正なレポート理由です";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}
