package com.photlas.backend.validation;

import com.photlas.backend.dto.DeleteAccountRequest;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.UserRepository;
import jakarta.validation.ConstraintValidatorContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Issue#81 Phase 4a - {@link DeleteAccountRequestValidator} のテスト（Red 段階）。
 *
 * <p>Round 12 四次精査 / Q15 / [4-A-T1〜T3] の TDD ケースを包含:
 * <ul>
 *   <li>T1: 通常ユーザー (password_hash != null) で password==null を拒否</li>
 *   <li>T2: OAuth のみユーザー (password_hash == null) で password!=null を拒否</li>
 *   <li>T3: OAuth のみユーザーで confirmationChecked != true を拒否</li>
 * </ul>
 *
 * <p>加えて正常ケース・境界ケース・認証不在を検証。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DeleteAccountRequestValidatorTest {

    private static final String AUTHENTICATED_EMAIL = "user@example.com";

    @Mock
    private UserRepository userRepository;

    @Mock
    private ConstraintValidatorContext context;

    private DeleteAccountRequestValidator validator;

    @BeforeEach
    void setUp() {
        validator = new DeleteAccountRequestValidator(userRepository);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(AUTHENTICATED_EMAIL, null));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    // ---------- 通常ユーザー（password_hash != null）----------

    @Test
    @DisplayName("[T1] 通常ユーザー: password=null は拒否")
    void normalUser_rejectsNullPassword() {
        when(userRepository.findByEmail(AUTHENTICATED_EMAIL))
                .thenReturn(Optional.of(normalUser()));
        DeleteAccountRequest request = new DeleteAccountRequest();
        request.setPassword(null);

        assertThat(validator.isValid(request, context)).isFalse();
    }

    @Test
    @DisplayName("通常ユーザー: password=\"\" （空文字）も拒否")
    void normalUser_rejectsEmptyPassword() {
        when(userRepository.findByEmail(AUTHENTICATED_EMAIL))
                .thenReturn(Optional.of(normalUser()));
        DeleteAccountRequest request = new DeleteAccountRequest();
        request.setPassword("");

        assertThat(validator.isValid(request, context)).isFalse();
    }

    @Test
    @DisplayName("通常ユーザー: password を送れば confirmationChecked は不問で valid")
    void normalUser_validWithPasswordRegardlessOfConfirmation() {
        when(userRepository.findByEmail(AUTHENTICATED_EMAIL))
                .thenReturn(Optional.of(normalUser()));
        DeleteAccountRequest request = new DeleteAccountRequest();
        request.setPassword("mypassword123");
        request.setConfirmationChecked(null);

        assertThat(validator.isValid(request, context)).isTrue();
    }

    // ---------- OAuth のみユーザー（password_hash == null）----------

    @Test
    @DisplayName("[T2] OAuth のみユーザー: password が送信されていたら拒否（ロジック取り違え防止）")
    void oauthOnlyUser_rejectsPasswordProvided() {
        when(userRepository.findByEmail(AUTHENTICATED_EMAIL))
                .thenReturn(Optional.of(oauthOnlyUser()));
        DeleteAccountRequest request = new DeleteAccountRequest();
        request.setPassword("should-not-be-provided");
        request.setConfirmationChecked(true);

        assertThat(validator.isValid(request, context)).isFalse();
    }

    @Test
    @DisplayName("[T3] OAuth のみユーザー: confirmationChecked != true は拒否")
    void oauthOnlyUser_rejectsUncheckedConfirmation() {
        when(userRepository.findByEmail(AUTHENTICATED_EMAIL))
                .thenReturn(Optional.of(oauthOnlyUser()));
        DeleteAccountRequest request = new DeleteAccountRequest();
        request.setPassword(null);
        request.setConfirmationChecked(false);

        assertThat(validator.isValid(request, context)).isFalse();
    }

    @Test
    @DisplayName("OAuth のみユーザー: confirmationChecked == null も拒否")
    void oauthOnlyUser_rejectsNullConfirmation() {
        when(userRepository.findByEmail(AUTHENTICATED_EMAIL))
                .thenReturn(Optional.of(oauthOnlyUser()));
        DeleteAccountRequest request = new DeleteAccountRequest();
        request.setPassword(null);
        request.setConfirmationChecked(null);

        assertThat(validator.isValid(request, context)).isFalse();
    }

    @Test
    @DisplayName("OAuth のみユーザー: password=null かつ confirmationChecked=true は valid")
    void oauthOnlyUser_validWithConfirmationAndNullPassword() {
        when(userRepository.findByEmail(AUTHENTICATED_EMAIL))
                .thenReturn(Optional.of(oauthOnlyUser()));
        DeleteAccountRequest request = new DeleteAccountRequest();
        request.setPassword(null);
        request.setConfirmationChecked(true);

        assertThat(validator.isValid(request, context)).isTrue();
    }

    // ---------- エッジケース ----------

    @Test
    @DisplayName("認証情報が無い場合は拒否（SecurityContext が空）")
    void noAuthentication_returnsFalse() {
        SecurityContextHolder.clearContext();
        DeleteAccountRequest request = new DeleteAccountRequest();
        request.setPassword("any");

        assertThat(validator.isValid(request, context)).isFalse();
    }

    @Test
    @DisplayName("認証済み email に対応するユーザーが見つからない場合は拒否")
    void userNotFound_returnsFalse() {
        when(userRepository.findByEmail(AUTHENTICATED_EMAIL))
                .thenReturn(Optional.empty());
        DeleteAccountRequest request = new DeleteAccountRequest();
        request.setPassword("any");

        assertThat(validator.isValid(request, context)).isFalse();
    }

    // ---------- ヘルパー ----------

    private static User normalUser() {
        User user = new User("alice", AUTHENTICATED_EMAIL, "$2a$12$hashedPassword", CodeConstants.ROLE_USER);
        user.setId(100L);
        user.setEmailVerified(true);
        return user;
    }

    private static User oauthOnlyUser() {
        User user = new User("bob", AUTHENTICATED_EMAIL, null, CodeConstants.ROLE_USER);
        user.setId(200L);
        user.setEmailVerified(true);
        return user;
    }
}
