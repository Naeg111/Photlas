package com.photlas.backend.service;

import com.photlas.backend.dto.UpdateSnsLinksRequest;
import com.photlas.backend.dto.UserProfileResponse;
import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.entity.User;
import com.photlas.backend.entity.UserSnsLink;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.repository.UserSnsLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Issue#102: SNSリンク機能の修正
 * - YouTube/TikTok 一時停止
 * - Threads(605) 追加
 * - UserProfileResponse.SnsLink に platform 追加
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProfileServiceTest {

    @Autowired
    private ProfileService profileService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserSnsLinkRepository userSnsLinkRepository;

    @MockBean
    private S3Service s3Service;

    private User testUser;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.when(s3Service.generateCdnUrl(org.mockito.ArgumentMatchers.any()))
                .thenReturn(null);

        userSnsLinkRepository.deleteAll();
        userRepository.deleteAll();

        testUser = new User();
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPasswordHash("hashedpassword");
        testUser.setRole(CodeConstants.ROLE_USER);
        testUser = userRepository.save(testUser);
    }

    @Test
    @DisplayName("Issue#102 - Threads(605) のURL (threads.com) が保存できる")
    void testUpdateSnsLinks_ThreadsCom_Saved() {
        var request = new UpdateSnsLinksRequest.SnsLinkRequest(
                CodeConstants.PLATFORM_THREADS,
                "https://www.threads.com/@user");

        List<UserSnsLink> result = profileService.updateSnsLinks(
                testUser.getEmail(), List.of(request));

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getPlatform()).isEqualTo(CodeConstants.PLATFORM_THREADS);
        assertThat(result.get(0).getUrl()).isEqualTo("https://www.threads.com/@user");
    }

    @Test
    @DisplayName("Issue#102 - Threads の旧ドメイン (threads.net) も保存できる")
    void testUpdateSnsLinks_ThreadsNet_Saved() {
        var request = new UpdateSnsLinksRequest.SnsLinkRequest(
                CodeConstants.PLATFORM_THREADS,
                "https://www.threads.net/@user");

        List<UserSnsLink> result = profileService.updateSnsLinks(
                testUser.getEmail(), List.of(request));

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getUrl()).isEqualTo("https://www.threads.net/@user");
    }

    @Test
    @DisplayName("Issue#102 - YouTube(603) のリンク登録が拒否される（ALLOWED_PLATFORMS から除外）")
    void testUpdateSnsLinks_YouTube_Rejected() {
        var request = new UpdateSnsLinksRequest.SnsLinkRequest(
                CodeConstants.PLATFORM_YOUTUBE,
                "https://youtube.com/@user");

        assertThatThrownBy(() -> profileService.updateSnsLinks(
                testUser.getEmail(), List.of(request)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("未対応のプラットフォーム");
    }

    @Test
    @DisplayName("Issue#102 - TikTok(604) のリンク登録が拒否される（ALLOWED_PLATFORMS から除外）")
    void testUpdateSnsLinks_TikTok_Rejected() {
        var request = new UpdateSnsLinksRequest.SnsLinkRequest(
                CodeConstants.PLATFORM_TIKTOK,
                "https://tiktok.com/@user");

        assertThatThrownBy(() -> profileService.updateSnsLinks(
                testUser.getEmail(), List.of(request)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("未対応のプラットフォーム");
    }

    @Test
    @DisplayName("Issue#102 - Instagram の入力欄に Threads の URL を入れた場合は拒否される")
    void testUpdateSnsLinks_InstagramWithThreadsUrl_Rejected() {
        var request = new UpdateSnsLinksRequest.SnsLinkRequest(
                CodeConstants.PLATFORM_INSTAGRAM,
                "https://www.threads.com/@user");

        assertThatThrownBy(() -> profileService.updateSnsLinks(
                testUser.getEmail(), List.of(request)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    @Test
    @DisplayName("Issue#102 - Threads の入力欄に X の URL を入れた場合は拒否される")
    void testUpdateSnsLinks_ThreadsWithXUrl_Rejected() {
        var request = new UpdateSnsLinksRequest.SnsLinkRequest(
                CodeConstants.PLATFORM_THREADS,
                "https://x.com/user");

        assertThatThrownBy(() -> profileService.updateSnsLinks(
                testUser.getEmail(), List.of(request)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    @Test
    @DisplayName("Issue#102 - X / Instagram / Threads の3種を同時登録できる")
    void testUpdateSnsLinks_ThreeAllowedPlatforms_Saved() {
        List<UpdateSnsLinksRequest.SnsLinkRequest> requests = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(
                        CodeConstants.PLATFORM_INSTAGRAM, "https://www.instagram.com/user"),
                new UpdateSnsLinksRequest.SnsLinkRequest(
                        CodeConstants.PLATFORM_THREADS, "https://www.threads.com/@user"),
                new UpdateSnsLinksRequest.SnsLinkRequest(
                        CodeConstants.PLATFORM_TWITTER, "https://x.com/user"));

        List<UserSnsLink> result = profileService.updateSnsLinks(testUser.getEmail(), requests);

        assertThat(result).hasSize(3);
    }

    @Test
    @DisplayName("Issue#102 - getMyProfile のレスポンス SnsLink に platform フィールドが含まれる")
    void testGetMyProfile_SnsLinkIncludesPlatform() {
        UserSnsLink link = new UserSnsLink(
                testUser.getId(),
                CodeConstants.PLATFORM_THREADS,
                "https://www.threads.com/@user");
        userSnsLinkRepository.save(link);

        UserProfileResponse response = profileService.getMyProfile(testUser.getEmail());

        assertThat(response.getSnsLinks()).hasSize(1);
        UserProfileResponse.SnsLink dto = response.getSnsLinks().get(0);
        assertThat(dto.getPlatform()).isEqualTo(CodeConstants.PLATFORM_THREADS);
        assertThat(dto.getUrl()).isEqualTo("https://www.threads.com/@user");
    }

    @Test
    @DisplayName("Issue#102 - PLATFORM_THREADS の値が 605 で 600番台に収まる")
    void testPlatformThreadsConstant() {
        assertThat(CodeConstants.PLATFORM_THREADS).isEqualTo(605);
        assertThat(CodeConstants.PLATFORM_THREADS).isBetween(600, 699);
    }

    // ===== Issue#100: タグベース孤立ファイル対応 =====

    @Test
    @DisplayName("Issue#100 - updateProfileImage: ユーザー保存前にタグを status=registered に更新する")
    void testUpdateProfileImage_UpdatesTagToRegisteredBeforeUserSave() {
        String objectKey = "profile-images/" + testUser.getId() + "/issue100-test.jpg";

        profileService.updateProfileImage(testUser.getEmail(), objectKey);

        // タグが registered に更新されたことを検証
        org.mockito.Mockito.verify(s3Service).updateObjectTag(
                objectKey,
                S3Service.STATUS_TAG_KEY,
                S3Service.STATUS_TAG_VALUE_REGISTERED
        );
    }

    @Test
    @DisplayName("Issue#100 - updateProfileImage: タグ更新が失敗した場合はユーザー保存を行わずエラーを返す")
    void testUpdateProfileImage_TagUpdateFails_DoesNotSaveUserAndThrows() {
        org.mockito.Mockito.doThrow(new RuntimeException("S3 tag update failed"))
                .when(s3Service).updateObjectTag(
                        org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.eq(S3Service.STATUS_TAG_KEY),
                        org.mockito.ArgumentMatchers.eq(S3Service.STATUS_TAG_VALUE_REGISTERED)
                );

        String objectKey = "profile-images/" + testUser.getId() + "/issue100-fail.jpg";

        assertThatThrownBy(() -> profileService.updateProfileImage(testUser.getEmail(), objectKey))
                .isInstanceOf(RuntimeException.class);

        // ユーザーレコードに profileImageS3Key がセットされていない（変更されていない）ことを検証
        User reloaded = userRepository.findByEmail(testUser.getEmail()).orElseThrow();
        assertThat(reloaded.getProfileImageS3Key()).isNotEqualTo(objectKey);
    }
}
