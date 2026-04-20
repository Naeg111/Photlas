package com.photlas.backend.validation;

import com.photlas.backend.dto.DeleteAccountRequest;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.UserRepository;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

/**
 * Issue#81 Phase 4a - {@link ValidDeleteAccountRequest} のバリデーター実装。
 *
 * <p>SecurityContext から current user を解決し、{@code passwordHash} の有無で分岐:
 * <ul>
 *   <li>password_hash != null（通常 / ハイブリッドユーザー）:
 *       {@code password} が非 null かつ非空であれば valid。{@code confirmationChecked} は不問。</li>
 *   <li>password_hash == null（OAuth のみユーザー）:
 *       {@code password} は null 必須かつ {@code confirmationChecked == true} が必須。</li>
 * </ul>
 *
 * <p>認証情報が無い、または current user が DB に存在しない場合は {@code false}。
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
        if (value == null) {
            return false;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            return false;
        }

        Optional<User> userOpt = userRepository.findByEmail(authentication.getName());
        if (userOpt.isEmpty()) {
            return false;
        }

        User user = userOpt.get();
        String password = value.getPassword();
        Boolean confirmationChecked = value.getConfirmationChecked();

        if (user.getPasswordHash() != null) {
            // 通常 / ハイブリッドユーザー: password 必須（空文字不可）
            return password != null && !password.isEmpty();
        }

        // OAuth のみユーザー: password は null 必須、confirmationChecked == true が必須
        return password == null && Boolean.TRUE.equals(confirmationChecked);
    }
}
