package com.photlas.backend.service;

import com.photlas.backend.entity.OAuthLinkConfirmation;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.repository.OAuthLinkConfirmationRepository;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;

/**
 * Issue#81 Phase 4g - OAuth アカウントリンク確認サービス（Q1）。
 *
 * <p>既存パスワードアカウントと OAuth 連携を結ぶ前に、ユーザーに明示確認させるための
 * 短命トークン（TTL 5 分）を発行・消費する。
 */
@Service
public class OAuthLinkConfirmationService {

    /** トークン TTL（発行から 5 分）。 */
    static final int TOKEN_TTL_MINUTES = 5;
    /** 生トークンのバイト長（32 バイト → hex 64 文字）。 */
    private static final int TOKEN_BYTES = 32;

    private final OAuthLinkConfirmationRepository repository;
    private final UserRepository userRepository;
    private final UserOAuthConnectionRepository userOAuthConnectionRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    public OAuthLinkConfirmationService(
            OAuthLinkConfirmationRepository repository,
            UserRepository userRepository,
            UserOAuthConnectionRepository userOAuthConnectionRepository) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.userOAuthConnectionRepository = userOAuthConnectionRepository;
    }

    /**
     * リンク確認トークンを発行する。生トークンのみ呼び出し元に返し、DB には SHA-256 ハッシュを保存する。
     *
     * <p>Issue#99: 呼び出し元 ({@link OAuth2UserServiceHelper#processOAuthUser}) は
     * 直後に {@link com.photlas.backend.security.OAuth2LinkConfirmationException} を投げるため、
     * 外側のトランザクションは必ずロールバックされる。本メソッドの save() を保護するために
     * {@link Propagation#REQUIRES_NEW} で独立トランザクションとして実行し、
     * 外側のロールバックの影響を受けないようにする。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String issue(Long userId, OAuthProvider provider, String providerUserId, String providerEmail) {
        String rawToken = generateRawToken();
        String hashed = sha256Hex(rawToken);

        OAuthLinkConfirmation record = new OAuthLinkConfirmation();
        record.setTokenHash(hashed);
        record.setUserId(userId);
        record.setProviderCode(provider.getCode());
        record.setProviderUserId(providerUserId);
        record.setProviderEmail(providerEmail);
        record.setExpiresAt(LocalDateTime.now().plusMinutes(TOKEN_TTL_MINUTES));
        repository.save(record);

        return rawToken;
    }

    /**
     * リンク確認トークンを消費し、UserOAuthConnection を作成する。
     *
     * @throws IllegalArgumentException トークンが無効・期限切れ・消費済み、またはユーザーが
     *         見つからない / ソフトデリートされている場合
     */
    @Transactional
    public User consume(String rawToken) {
        String hashed = sha256Hex(rawToken);
        OAuthLinkConfirmation record = repository.findByTokenHash(hashed)
                .orElseThrow(() -> new IllegalArgumentException("リンク確認トークンが無効です"));

        if (record.getConsumedAt() != null) {
            throw new IllegalArgumentException("リンク確認トークンは既に使用されています");
        }
        if (record.getExpiresAt() == null || record.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("リンク確認トークンの有効期限が切れています");
        }

        User user = userRepository.findById(record.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("対象ユーザーが見つかりません"));
        if (user.getDeletedAt() != null) {
            // [T6] 発行後にソフトデリートされたユーザーは拒否
            throw new IllegalArgumentException("対象ユーザーは退会済みです");
        }

        // UserOAuthConnection を新規作成して保存
        UserOAuthConnection connection = new UserOAuthConnection();
        connection.setUserId(record.getUserId());
        connection.setProviderCode(record.getProviderCode());
        connection.setProviderUserId(record.getProviderUserId());
        connection.setEmail(record.getProviderEmail());
        connection.setEmailVerified(true);
        userOAuthConnectionRepository.save(connection);

        // 消費済みにマーク
        record.setConsumedAt(LocalDateTime.now());
        repository.save(record);

        return user;
    }

    /**
     * 32 バイトの SecureRandom 値を hex 64 文字で返す。
     */
    private String generateRawToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(input.getBytes()));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 ダイジェスト計算に失敗", e);
        }
    }
}
