package com.photlas.backend.service;

import com.photlas.backend.repository.EmailVerificationTokenRepository;
import com.photlas.backend.repository.PasswordResetTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;

/**
 * 期限切れトークンの自動クリーンアップサービス
 * 1時間ごとに期限切れのパスワードリセットトークンとメール認証トークンを削除する。
 */
@Service
public class TokenCleanupService {

    private static final Logger logger = LoggerFactory.getLogger(TokenCleanupService.class);

    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;

    public TokenCleanupService(
            PasswordResetTokenRepository passwordResetTokenRepository,
            EmailVerificationTokenRepository emailVerificationTokenRepository) {
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.emailVerificationTokenRepository = emailVerificationTokenRepository;
    }

    /**
     * 期限切れトークンを削除する
     * 1時間ごとに自動実行される
     */
    @Scheduled(fixedRate = 3600000)
    @Transactional
    public void cleanupExpiredTokens() {
        Date now = new Date();

        passwordResetTokenRepository.deleteByExpiryDateBefore(now);
        emailVerificationTokenRepository.deleteByExpiryDateBefore(now);

        logger.info("期限切れトークンのクリーンアップを実行しました");
    }
}
