package com.photlas.backend.service;

import com.photlas.backend.dto.PasswordRecommendationResponse;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;

/**
 * Issue#81 Phase 4f - パスワード推奨バナー制御サービス（Round 12 / Q8）。
 *
 * <p>Red 段階のスタブ実装。
 */
public class PasswordRecommendationService {

    static final int DISMISS_TTL_DAYS = 7;

    private final UserRepository userRepository;
    private final UserOAuthConnectionRepository userOAuthConnectionRepository;

    public PasswordRecommendationService(
            UserRepository userRepository,
            UserOAuthConnectionRepository userOAuthConnectionRepository) {
        this.userRepository = userRepository;
        this.userOAuthConnectionRepository = userOAuthConnectionRepository;
    }

    /**
     * 指定 email のユーザーに対し、バナー表示要否と推奨プロバイダ名を返す。
     */
    public PasswordRecommendationResponse evaluate(String email) {
        throw new UnsupportedOperationException("Phase 4f Green で実装する");
    }

    /**
     * 指定 email のユーザーのバナー表示を 7 日間抑止する（dismissed_at を NOW() に更新）。
     */
    public void dismiss(String email) {
        throw new UnsupportedOperationException("Phase 4f Green で実装する");
    }

    @SuppressWarnings("unused")
    private User findUserOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("ユーザーが見つかりません"));
    }
}
