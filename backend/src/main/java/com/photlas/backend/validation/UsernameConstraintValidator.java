package com.photlas.backend.validation;

import com.photlas.backend.exception.InvalidUsernameException;
import com.photlas.backend.util.UsernameValidator;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * {@link ValidUsername} の検証実装。
 * Issue#98: ユーザー名バリデーション強化。
 *
 * <p>{@link UsernameValidator} に処理を委譲し、{@link InvalidUsernameException} を
 * 捕捉してそのエラーキー（例: {@code USERNAME_RESERVED}）を i18n フォーマット
 * （{@code errors.USERNAME_RESERVED}）に整形してメッセージとして設定する。
 *
 * <p>これにより {@code MethodArgumentNotValidException} 経由で 400 Bad Request の
 * {@code ErrorResponse.errors[].message} に i18n キー文字列が入り、
 * フロントエンドで {@code t(message)} フックして 5 言語表示できる。
 */
public class UsernameConstraintValidator implements ConstraintValidator<ValidUsername, String> {

    @Override
    public boolean isValid(String username, ConstraintValidatorContext context) {
        try {
            UsernameValidator.validate(username);
            return true;
        } catch (InvalidUsernameException e) {
            // 既定メッセージを無効化し、i18n キー（errors.USERNAME_*）を動的に設定
            context.disableDefaultConstraintViolation();
            context.buildConstraintViolationWithTemplate("errors." + e.getErrorKey())
                    .addConstraintViolation();
            return false;
        }
    }
}
