package com.photlas.backend.validation;

import com.photlas.backend.repository.UserRepository;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * EmailUniqueバリデーターの実装クラス
 * メールアドレスの一意性をデータベースと照合して検証します。
 */
public class EmailUniqueValidator implements ConstraintValidator<EmailUnique, String> {

    private final UserRepository userRepository;

    public EmailUniqueValidator(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public boolean isValid(String email, ConstraintValidatorContext context) {
        if (email == null) {
            return true; // Let @NotNull handle null validation
        }
        return !userRepository.existsByEmail(email);
    }
}