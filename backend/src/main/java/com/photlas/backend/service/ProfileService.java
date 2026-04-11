package com.photlas.backend.service;

import com.photlas.backend.dto.UpdateProfileRequest;
import com.photlas.backend.dto.UpdateSnsLinksRequest;
import com.photlas.backend.dto.UserProfileResponse;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserSnsLink;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.exception.UserNotFoundException;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.repository.UserSnsLinkRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * プロフィールサービス
 * プロフィール取得・更新、画像管理、SNSリンク管理のビジネスロジックを提供する。
 */
@Service
public class ProfileService {

    private static final List<Integer> ALLOWED_PLATFORMS = List.of(
            CodeConstants.PLATFORM_TWITTER, CodeConstants.PLATFORM_INSTAGRAM,
            CodeConstants.PLATFORM_YOUTUBE, CodeConstants.PLATFORM_TIKTOK);
    private static final String ERROR_USER_NOT_FOUND = "ユーザーが見つかりません";
    private static final String ERROR_UNSUPPORTED_PLATFORM = "未対応のプラットフォームです: ";
    private static final String ERROR_DUPLICATE_PLATFORM = "同じプラットフォームが重複しています: ";
    private static final String ERROR_INVALID_URL_FOR_PLATFORM = "URLがプラットフォームと一致しません";

    private final UserRepository userRepository;
    private final UserSnsLinkRepository userSnsLinkRepository;
    private final S3Service s3Service;

    public ProfileService(
            UserRepository userRepository,
            UserSnsLinkRepository userSnsLinkRepository,
            S3Service s3Service) {
        this.userRepository = userRepository;
        this.userSnsLinkRepository = userSnsLinkRepository;
        this.s3Service = s3Service;
    }

    /**
     * 自分のユーザー情報を取得
     */
    @Transactional(readOnly = true)
    public UserProfileResponse getMyProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        return buildProfileResponse(user, true);
    }

    /**
     * 他ユーザーのプロフィール情報を取得
     */
    @Transactional(readOnly = true)
    public UserProfileResponse getUserProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new UserNotFoundException(ERROR_USER_NOT_FOUND));

        if (user.getDeletedAt() != null) {
            throw new UserNotFoundException(ERROR_USER_NOT_FOUND);
        }

        return buildProfileResponse(user, false);
    }

    /**
     * プロフィール情報を更新
     */
    @Transactional
    public UserProfileResponse updateProfile(String email, UpdateProfileRequest request) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        user.setUsername(request.getUsername());

        if (request.getProfileImageS3Key() != null) {
            user.setProfileImageS3Key(request.getProfileImageS3Key());
        }

        userRepository.save(user);

        return getMyProfile(email);
    }

    /**
     * プロフィール画像を更新
     * S3キーのプレフィックスがログインユーザーのIDと一致するか検証する。
     */
    @Transactional
    public String updateProfileImage(String email, String objectKey) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        // S3キーの正当性チェック: profile-images/{userId}/ で始まるか検証
        String expectedPrefix = "profile-images/" + user.getId() + "/";
        if (!objectKey.startsWith(expectedPrefix)) {
            throw new IllegalArgumentException("不正なオブジェクトキーです");
        }

        user.setProfileImageS3Key(objectKey);
        userRepository.save(user);

        return s3Service.generateCdnUrl(objectKey);
    }

    /**
     * プロフィール画像を削除（S3上のファイルも削除）
     */
    @Transactional
    public void deleteProfileImage(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        String oldKey = user.getProfileImageS3Key();
        user.setProfileImageS3Key(null);
        userRepository.save(user);

        if (oldKey != null) {
            s3Service.deleteS3Object(oldKey);
        }
    }

    /**
     * SNSリンクを更新
     */
    @Transactional
    public List<UserSnsLink> updateSnsLinks(String email, List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        validateSnsLinks(snsLinks);

        userSnsLinkRepository.deleteByUserId(user.getId());

        if (snsLinks != null) {
            for (var snsLinkRequest : snsLinks) {
                UserSnsLink snsLink = new UserSnsLink(
                        user.getId(),
                        snsLinkRequest.getPlatform(),
                        snsLinkRequest.getUrl()
                );
                userSnsLinkRepository.save(snsLink);
            }
        }

        return userSnsLinkRepository.findByUserId(user.getId());
    }

    /**
     * ユーザー名を更新
     */
    @Transactional
    public String updateUsername(String email, String username) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        user.setUsername(username);
        userRepository.save(user);

        return user.getUsername();
    }

    /**
     * プロフィールレスポンスを構築（共通ロジック）
     */
    private UserProfileResponse buildProfileResponse(User user, boolean includeEmail) {
        List<UserSnsLink> snsLinks = userSnsLinkRepository.findByUserId(user.getId());
        List<UserProfileResponse.SnsLink> snsLinkDtos = snsLinks.stream()
                .map(link -> new UserProfileResponse.SnsLink(link.getUrl()))
                .collect(Collectors.toList());

        String profileImageUrl = s3Service.generateCdnUrl(user.getProfileImageS3Key());

        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                includeEmail ? user.getEmail() : null,
                includeEmail ? user.getLanguage() : null,
                profileImageUrl,
                snsLinkDtos
        );
    }

    /**
     * SNSリンクのバリデーション
     */
    private void validateSnsLinks(List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks) {
        if (snsLinks == null) {
            return;
        }

        Set<Integer> platforms = new HashSet<>();
        for (UpdateSnsLinksRequest.SnsLinkRequest snsLink : snsLinks) {
            int platformCode = snsLink.getPlatform();
            if (!ALLOWED_PLATFORMS.contains(platformCode)) {
                throw new IllegalArgumentException(ERROR_UNSUPPORTED_PLATFORM + platformCode);
            }
            if (!platforms.add(platformCode)) {
                throw new IllegalArgumentException(ERROR_DUPLICATE_PLATFORM + platformCode);
            }
            if (!isValidUrlForPlatform(platformCode, snsLink.getUrl())) {
                throw new IllegalArgumentException(ERROR_INVALID_URL_FOR_PLATFORM);
            }
        }
    }

    private boolean isValidUrlForPlatform(int platformCode, String url) {
        try {
            java.net.URI uri = new java.net.URI(url);
            String host = uri.getHost();
            if (host == null) return false;
            host = host.toLowerCase();
            return switch (platformCode) {
                case CodeConstants.PLATFORM_TWITTER -> host.equals("x.com") || host.equals("twitter.com")
                        || host.endsWith(".x.com") || host.endsWith(".twitter.com");
                case CodeConstants.PLATFORM_INSTAGRAM -> host.equals("instagram.com") || host.endsWith(".instagram.com");
                case CodeConstants.PLATFORM_YOUTUBE -> host.equals("youtube.com") || host.endsWith(".youtube.com");
                case CodeConstants.PLATFORM_TIKTOK -> host.equals("tiktok.com") || host.endsWith(".tiktok.com");
                default -> false;
            };
        } catch (Exception e) {
            return false;
        }
    }
}
