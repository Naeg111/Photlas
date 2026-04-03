package com.photlas.backend.service;

import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * アカウントサービス
 * メールアドレス変更��アカウント削除のビジネスロジックを提供する。
 */
@Service
public class AccountService {

    private static final String ERROR_USER_NOT_FOUND = "ユーザーが見つかりません";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SpotRepository spotRepository;
    private final PhotoRepository photoRepository;

    public AccountService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            SpotRepository spotRepository,
            PhotoRepository photoRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.spotRepository = spotRepository;
        this.photoRepository = photoRepository;
    }

    /**
     * メールアドレス変更
     */
    @Transactional
    public String updateEmail(String email, String newEmail, String currentPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new UnauthorizedException("パスワードが正しくありません");
        }

        String normalizedNewEmail = newEmail.toLowerCase();
        if (email.equals(normalizedNewEmail)) {
            return user.getEmail();
        }

        Optional<User> existingUser = userRepository.findByEmail(normalizedNewEmail);
        if (existingUser.isPresent() && !existingUser.get().getId().equals(user.getId())) {
            throw new ConflictException("このメールアドレスはすでに使用されています");
        }

        user.setEmail(normalizedNewEmail);
        userRepository.save(user);

        return user.getEmail();
    }

    /**
     * アカウント削除 - ソフトデリート
     * 即時物理削除は行わず、deleted_atを設定して論理削除する。
     * 90日後にバッチ処理で物理削除される。
     */
    @Transactional
    public void deleteAccount(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new UnauthorizedException("パスワードが正しくありません");
        }

        transferSpotOwnership(user);

        user.setOriginalUsername(user.getUsername());
        user.setUsername("d_" + UUID.randomUUID().toString().substring(0, 10));

        user.setDeletedAt(java.time.LocalDateTime.now());
        userRepository.save(user);
    }

    /**
     * スポット所有権の移転
     */
    private void transferSpotOwnership(User deletingUser) {
        List<Spot> ownedSpots = spotRepository.findByCreatedByUserId(deletingUser.getId());
        for (Spot spot : ownedSpots) {
            Optional<User> nextOwner = photoRepository
                    .findOldestActiveUserBySpotExcluding(spot.getSpotId(), deletingUser.getId());
            nextOwner.ifPresent(owner -> spot.setCreatedByUserId(owner.getId()));
        }
    }
}
