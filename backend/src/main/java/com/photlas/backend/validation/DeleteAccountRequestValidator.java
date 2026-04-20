package com.photlas.backend.validation;

import com.photlas.backend.dto.DeleteAccountRequest;
import com.photlas.backend.repository.UserRepository;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Issue#81 Phase 4a - {@link ValidDeleteAccountRequest} のバリデーター。
 *
 * <p>実装は Green 段階で追加する。現状は常に {@code false} を返すスタブ。
 */
public class DeleteAccountRequestValidator
        implements ConstraintValidator<ValidDeleteAccountRequest, DeleteAccountRequest> {

    private final UserRepository userRepository;

    @Autowired
    public DeleteAccountRequestValidator(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public boolean isValid(DeleteAccountRequest value, ConstraintValidatorContext context) {
        throw new UnsupportedOperationException("Green 段階で実装する");
    }
}
