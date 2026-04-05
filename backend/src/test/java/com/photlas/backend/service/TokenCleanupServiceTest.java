package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.PasswordResetToken;
import com.photlas.backend.entity.EmailVerificationToken;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.EmailVerificationTokenRepository;
import com.photlas.backend.repository.PasswordResetTokenRepository;
import com.photlas.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 期限切れトークンの自動クリーンアップのテスト
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class TokenCleanupServiceTest {

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private EmailVerificationTokenRepository emailVerificationTokenRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TokenCleanupService tokenCleanupService;

    private User testUser;

    @BeforeEach
    void setUp() {
        passwordResetTokenRepository.deleteAll();
        emailVerificationTokenRepository.deleteAll();
        userRepository.deleteAll();

        testUser = new User();
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash("hashed");
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser = userRepository.save(testUser);
    }

    @Test
    @DisplayName("期限切れのパスワードリセットトークンが削除される")
    void testCleanup_ExpiredPasswordResetToken_IsDeleted() {
        // 1時間前に期限切れのトークンを作成
        Date expiredDate = new Date(System.currentTimeMillis() - 60 * 60 * 1000);
        PasswordResetToken token = new PasswordResetToken(testUser.getId(), "expired-token", expiredDate);
        passwordResetTokenRepository.save(token);

        tokenCleanupService.cleanupExpiredTokens();

        assertTrue(passwordResetTokenRepository.findByToken("expired-token").isEmpty(),
                "期限切れトークンが削除されている");
    }

    @Test
    @DisplayName("有効期限内のパスワードリセットトークンは削除されない")
    void testCleanup_ValidPasswordResetToken_IsNotDeleted() {
        // 30分後に期限切れのトークンを作成
        Date futureDate = new Date(System.currentTimeMillis() + 30 * 60 * 1000);
        PasswordResetToken token = new PasswordResetToken(testUser.getId(), "valid-token", futureDate);
        passwordResetTokenRepository.save(token);

        tokenCleanupService.cleanupExpiredTokens();

        assertTrue(passwordResetTokenRepository.findByToken("valid-token").isPresent(),
                "有効期限内のトークンは残っている");
    }

    @Test
    @DisplayName("期限切れのメール認証トークンが削除される")
    void testCleanup_ExpiredEmailVerificationToken_IsDeleted() {
        Date expiredDate = new Date(System.currentTimeMillis() - 60 * 60 * 1000);
        EmailVerificationToken token = new EmailVerificationToken(testUser.getId(), "expired-email-token", expiredDate);
        emailVerificationTokenRepository.save(token);

        tokenCleanupService.cleanupExpiredTokens();

        assertTrue(emailVerificationTokenRepository.findByToken("expired-email-token").isEmpty(),
                "期限切れメール認証トークンが削除されている");
    }
}
