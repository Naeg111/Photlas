package com.photlas.backend.service;

import com.photlas.backend.dto.PasswordRecommendationResponse;
import com.photlas.backend.entity.OAuthProvider;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserOAuthConnection;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.repository.UserOAuthConnectionRepository;
import com.photlas.backend.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Issue#81 Phase 4f - パスワード推奨バナー制御サービス（Round 12 / Q8 / [2-G]）。
 *
 * <p>判定条件（全て満たすと {@code shouldRecommend=true}）:
 * <ul>
 *   <li>{@code usernameTemporary == false}</li>
 *   <li>{@code password_hash IS NULL}</li>
 *   <li>{@code dismissed_at IS NULL} または {@code dismissed_at + 7 days < NOW()}</li>
 *   <li>{@code user_oauth_connections} にレコードが存在する（空ならフェイルセーフで false）</li>
 * </ul>
 *
 * <p>dismiss は {@code users.password_recommendation_dismissed_at} を NOW() に更新する。
 */
@Service
public class PasswordRecommendationService {

    private static final Logger logger = LoggerFactory.getLogger(PasswordRecommendationService.class);

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
     * 指定 email のユーザーに対しバナー表示要否と推奨プロバイダ名を返す。
     */
    @Transactional(readOnly = true)
    public PasswordRecommendationResponse evaluate(String email) {
        User user = findUserOrThrow(email);

        // password_hash != null: パスワード既設定、推奨不要
        if (user.getPasswordHash() != null) {
            return new PasswordRecommendationResponse(false, null);
        }

        // ユーザー名が仮のうちは表示しない（ユーザー名確定導線を優先）
        if (user.isUsernameTemporary()) {
            return new PasswordRecommendationResponse(false, null);
        }

        // dismissed_at が 7 日以内なら抑止
        LocalDateTime dismissedAt = user.getPasswordRecommendationDismissedAt();
        if (dismissedAt != null && dismissedAt.plusDays(DISMISS_TTL_DAYS).isAfter(LocalDateTime.now())) {
            return new PasswordRecommendationResponse(false, null);
        }

        // OAuth 連携が無ければデータ不整合（§3.28 で保証されているはず）、フェイルセーフ
        List<UserOAuthConnection> connections = userOAuthConnectionRepository.findByUserId(user.getId());
        if (connections.isEmpty()) {
            logger.warn("OAuth のみユーザー (id={}) に user_oauth_connections レコードが存在しません。データ不整合の可能性。",
                    user.getId());
            return new PasswordRecommendationResponse(false, null);
        }

        String providerName = resolveProviderName(connections);
        return new PasswordRecommendationResponse(true, providerName);
    }

    /**
     * バナー表示を 7 日間抑止する（dismissed_at を NOW() に更新）。
     */
    @Transactional
    public void dismiss(String email) {
        User user = findUserOrThrow(email);
        user.setPasswordRecommendationDismissedAt(LocalDateTime.now());
        userRepository.save(user);
    }

    /**
     * 単一連携ならそのプロバイダ名、複数連携なら最初に見つかったプロバイダ名を返す。
     * バナー文言の {{provider}} 置換用途（"GOOGLE" / "LINE"）。
     */
    private static String resolveProviderName(List<UserOAuthConnection> connections) {
        UserOAuthConnection first = connections.get(0);
        if (first.getProviderCode() == null) {
            return null;
        }
        return OAuthProvider.fromCode(first.getProviderCode()).name();
    }

    private User findUserOrThrow(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException("ユーザーが見つかりません"));
    }
}
