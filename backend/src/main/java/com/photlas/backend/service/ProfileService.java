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

    /**
     * Issue#102: 登録可能なSNSプラットフォーム一覧。
     * YouTube/TikTok はロゴ使用許可未取得のため一時停止中
     * （定数は CodeConstants に残置し、許可取得後に再追加して再開予定）。
     */
    private static final List<Integer> ALLOWED_PLATFORMS = List.of(
            CodeConstants.PLATFORM_TWITTER,
            CodeConstants.PLATFORM_INSTAGRAM,
            CodeConstants.PLATFORM_THREADS);
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

        // Issue#100: ユーザー保存の前にタグを registered に更新する。
        // タグ更新が失敗した場合はユーザー保存を行わずエラーを返す。
        s3Service.updateObjectTag(
                objectKey,
                S3Service.STATUS_TAG_KEY,
                S3Service.STATUS_TAG_VALUE_REGISTERED);

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
     * 表示名を更新
     *
     * <p>Issue#81 Phase 4h: 仮表示名 (OAuth 新規登録時の {@code user_xxxxxxx}) からの
     * 確定にも使えるよう、更新後に {@code usernameTemporary = false} を明示セットする。
     */
    @Transactional
    public String updateUsername(String email, String username) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        user.setUsername(username);
        user.setUsernameTemporary(false);
        userRepository.save(user);

        return user.getUsername();
    }

    /**
     * Issue#93: 言語設定を更新する
     *
     * @param email ユーザーのメールアドレス
     * @param language 言語コード
     */
    @Transactional
    public void updateLanguage(String email, String language) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));
        user.setLanguage(language);
        userRepository.save(user);
    }

    /**
     * プロフィールレスポンスを構築（共通ロジック）
     */
    private UserProfileResponse buildProfileResponse(User user, boolean includeEmail) {
        List<UserSnsLink> snsLinks = userSnsLinkRepository.findByUserId(user.getId());
        List<UserProfileResponse.SnsLink> snsLinkDtos = snsLinks.stream()
                .map(link -> new UserProfileResponse.SnsLink(link.getPlatform(), link.getUrl()))
                .collect(Collectors.toList());

        String profileImageUrl = s3Service.generateCdnUrl(user.getProfileImageS3Key());

        UserProfileResponse response = new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                includeEmail ? user.getEmail() : null,
                includeEmail ? user.getLanguage() : null,
                profileImageUrl,
                snsLinkDtos
        );

        // Issue#104 + Issue#109: GET /users/me のみで返す追加フィールド
        // 規約・プライバシー・年齢確認のいずれかが未完了なら同意ダイアログを表示する
        if (includeEmail) {
            boolean requiresAgreement = user.getTermsAgreedAt() == null
                    || user.getPrivacyPolicyAgreedAt() == null
                    || user.getAgeConfirmedAt() == null;
            response.setRequiresTermsAgreement(requiresAgreement);
            response.setUsernameTemporary(user.isUsernameTemporary());
        }

        return response;
    }

    /**
     * Issue#104 + Issue#109: 利用規約・プライバシーポリシー・年齢確認への同意を一括で記録する。
     *
     * <p>常に現在時刻で上書きする（冪等性を優先するシンプルな実装）。
     * 既に同意済みの場合でも再記録される（実害なし）。
     *
     * <p>Issue#109 で年齢確認のタイムスタンプも追加されたため、
     * Issue#104 時点の名称 {@code agreeToTerms} から本メソッド名にリネームした。
     * 規約・プライバシー・年齢確認の 3 つを同時に記録するため、
     * 名前が示す範囲を「ユーザーの同意全般を記録する」に拡張している。
     *
     * @param email ユーザーのメールアドレス
     */
    @Transactional
    public void recordUserAgreement(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(ERROR_USER_NOT_FOUND));

        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        user.setTermsAgreedAt(now);
        user.setPrivacyPolicyAgreedAt(now);
        user.setAgeConfirmedAt(now);
        userRepository.save(user);
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
                // Issue#102: YouTube/TikTok は ALLOWED_PLATFORMS から除外したため到達不能だが、
                // 将来再開時にコード変更なしで使えるようケースは残置。
                case CodeConstants.PLATFORM_YOUTUBE -> host.equals("youtube.com") || host.endsWith(".youtube.com");
                case CodeConstants.PLATFORM_TIKTOK -> host.equals("tiktok.com") || host.endsWith(".tiktok.com");
                // Issue#102: Threads は threads.com (現行) と threads.net (旧、リダイレクト) の両方を許可。
                case CodeConstants.PLATFORM_THREADS -> host.equals("threads.com") || host.endsWith(".threads.com")
                        || host.equals("threads.net") || host.endsWith(".threads.net");
                default -> false;
            };
        } catch (Exception e) {
            return false;
        }
    }
}
