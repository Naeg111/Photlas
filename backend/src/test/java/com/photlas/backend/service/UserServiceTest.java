package com.photlas.backend.service;

import com.photlas.backend.entity.CodeConstants;
import com.photlas.backend.dto.LoginRequest;
import com.photlas.backend.dto.RegisterRequest;
import com.photlas.backend.dto.UpdateProfileRequest;
import com.photlas.backend.dto.UpdateSnsLinksRequest;
import com.photlas.backend.entity.PasswordResetToken;
import com.photlas.backend.entity.Spot;
import com.photlas.backend.entity.User;
import com.photlas.backend.repository.PhotoRepository;
import com.photlas.backend.repository.SpotRepository;
import com.photlas.backend.exception.AccountSuspendedException;
import com.photlas.backend.exception.ConflictException;
import com.photlas.backend.exception.UnauthorizedException;
import com.photlas.backend.repository.EmailVerificationTokenRepository;
import com.photlas.backend.repository.PasswordResetTokenRepository;
import com.photlas.backend.repository.UserRepository;
import com.photlas.backend.repository.UserSnsLinkRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * サービス層のユニットテスト
 * AuthService, PasswordService, ProfileService, AccountServiceのビジネスロジックを検証する。
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
public class UserServiceTest {

    // ===== AuthService用モック =====
    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private JavaMailSender mailSender;
    @Mock private EmailVerificationTokenRepository emailVerificationTokenRepository;
    @InjectMocks private AuthService authService;

    // ===== PasswordService用モック =====
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @InjectMocks private PasswordService passwordService;

    // ===== ProfileService用モック =====
    @Mock private UserSnsLinkRepository userSnsLinkRepository;
    @Mock private S3Service s3Service;
    @InjectMocks private ProfileService profileService;

    // ===== AccountService用モック =====
    @Mock private SpotRepository spotRepository;
    @Mock private PhotoRepository photoRepository;
    @Mock private com.photlas.backend.repository.EmailChangeTokenRepository emailChangeTokenRepository;
    @Mock private EmailService emailService;
    // Issue#81 Phase 4d: 退会時 OAuth 連携検出 + revoke 用
    @Mock private com.photlas.backend.repository.UserOAuthConnectionRepository userOAuthConnectionRepository;
    @Mock private OAuthTokenRevokeService oauthTokenRevokeService;
    @InjectMocks private AccountService accountService;

    // テスト用定数
    private static final String TEST_EMAIL = "test@example.com";
    private static final String OTHER_EMAIL = "other@example.com";
    private static final String TEST_PASSWORD_HASH = "$2a$10$hashedpassword";
    private static final String CURRENT_PASSWORD = "CurrentPass1";
    private static final String NEW_PASSWORD = "NewPassword1";
    private static final String WRONG_PASSWORD = "WrongPass1";
    private static final String TEST_USERNAME = "testuser";
    private static final String NEW_USERNAME = "newuser";
    private static final String DUPLICATE_USERNAME = "existing";

    // ===== SNSリンクバリデーション (ProfileService.updateSnsLinks) =====

    @Test
    @DisplayName("Issue#29 - SNSリンク: 未対応プラットフォームでIllegalArgumentException")
    void testUpdateSnsLinks_UnsupportedPlatform_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(999, "https://facebook.com/user")
        );

        assertThatThrownBy(() -> profileService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("未対応のプラットフォームです");
    }

    @Test
    @DisplayName("Issue#29 - SNSリンク: 重複プラットフォームでIllegalArgumentException")
    void testUpdateSnsLinks_DuplicatePlatform_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_TWITTER, "https://x.com/user1"),
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_TWITTER, "https://x.com/user2")
        );

        assertThatThrownBy(() -> profileService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("同じプラットフォームが重複しています");
    }

    @Test
    @DisplayName("Issue#29 - SNSリンク: プラットフォームとURL不一致でIllegalArgumentException")
    void testUpdateSnsLinks_InvalidUrlForPlatform_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_INSTAGRAM, "https://youtube.com/channel")
        );

        assertThatThrownBy(() -> profileService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    @Test
    @DisplayName("Issue#29 - SNSリンク: twitter + x.com URLは正常に通る")
    void testUpdateSnsLinks_TwitterWithXUrl_Passes() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_TWITTER, "https://x.com/testuser")
        );

        profileService.updateSnsLinks(TEST_EMAIL, snsLinks);

        verify(userSnsLinkRepository).deleteByUserId(1L);
        verify(userSnsLinkRepository).save(argThat(link ->
                Integer.valueOf(CodeConstants.PLATFORM_TWITTER).equals(link.getPlatform()) && "https://x.com/testuser".equals(link.getUrl())
        ));
    }

    @Test
    @DisplayName("Issue#29 - SNSリンク: twitter + twitter.com URLは正常に通る")
    void testUpdateSnsLinks_TwitterWithTwitterUrl_Passes() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_TWITTER, "https://twitter.com/testuser")
        );

        profileService.updateSnsLinks(TEST_EMAIL, snsLinks);

        verify(userSnsLinkRepository).deleteByUserId(1L);
        verify(userSnsLinkRepository).save(argThat(link ->
                Integer.valueOf(CodeConstants.PLATFORM_TWITTER).equals(link.getPlatform()) && "https://twitter.com/testuser".equals(link.getUrl())
        ));
    }

    @Test
    @DisplayName("セキュリティ - SNSリンク: ドメイン偽装URL（x.com.evil.com）はエラー")
    void testUpdateSnsLinks_DomainSpoofing_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_TWITTER, "https://x.com.evil.com/phishing")
        );

        assertThatThrownBy(() -> profileService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    @Test
    @DisplayName("セキュリティ - SNSリンク: クエリパラメータにドメインを含むURL（evil.com?r=instagram.com）はエラー")
    void testUpdateSnsLinks_QueryParamSpoofing_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_INSTAGRAM, "https://evil.com/fake?redirect=instagram.com")
        );

        assertThatThrownBy(() -> profileService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    @Test
    @DisplayName("セキュリティ - SNSリンク: ドメイン名に含むURL（notinstagram.com）はエラー")
    void testUpdateSnsLinks_PartialDomainMatch_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));

        List<UpdateSnsLinksRequest.SnsLinkRequest> snsLinks = List.of(
                new UpdateSnsLinksRequest.SnsLinkRequest(CodeConstants.PLATFORM_INSTAGRAM, "https://notinstagram.com/user")
        );

        assertThatThrownBy(() -> profileService.updateSnsLinks(TEST_EMAIL, snsLinks))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URLがプラットフォームと一致しません");
    }

    // ===== メールアドレス変更リクエスト (AccountService.requestEmailChange) =====

    @Test
    @DisplayName("Issue#86 - メール変更: パスワード不一致でUnauthorizedException")
    void testRequestEmailChange_WrongPassword_ThrowsUnauthorized() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(WRONG_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() -> accountService.requestEmailChange(TEST_EMAIL, OTHER_EMAIL, WRONG_PASSWORD))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("パスワードが正しくありません");
    }

    @Test
    @DisplayName("Issue#86 - メール変更: 同じメールアドレスでIllegalArgumentException")
    void testRequestEmailChange_SameEmail_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);

        assertThatThrownBy(() -> accountService.requestEmailChange(TEST_EMAIL, TEST_EMAIL, CURRENT_PASSWORD))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("現在のメールアドレスと同じです");
    }

    @Test
    @DisplayName("Issue#86 - メール変更: 重複メールアドレスでConflictException")
    void testRequestEmailChange_DuplicateEmail_ThrowsConflict() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        User existingUser = createMockUser(2L, OTHER_EMAIL, "otheruser");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.findByEmail(OTHER_EMAIL)).thenReturn(Optional.of(existingUser));

        assertThatThrownBy(() -> accountService.requestEmailChange(TEST_EMAIL, OTHER_EMAIL, CURRENT_PASSWORD))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("このメールアドレスはすでに使用されています");
    }

    // ===== パスワード変更 (PasswordService.updatePassword) =====

    @Test
    @DisplayName("Issue#20 - パスワード変更: 現在のパスワード不一致でUnauthorizedException")
    void testUpdatePassword_WrongCurrentPassword_ThrowsUnauthorized() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(WRONG_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() ->
                passwordService.updatePassword(TEST_EMAIL, WRONG_PASSWORD, NEW_PASSWORD))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("現在のパスワードが正しくありません");
    }

    @Test
    @DisplayName("Issue#20 - パスワード変更: 成功時に通知メールが送信される")
    void testUpdatePassword_Success_SendsNotificationEmail() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(passwordEncoder.encode(NEW_PASSWORD)).thenReturn("$2a$10$newhashedpassword");

        passwordService.updatePassword(TEST_EMAIL, CURRENT_PASSWORD, NEW_PASSWORD);

        verify(emailService).send(eq(TEST_EMAIL), contains("パスワード"), anyString());
    }

    // ===== パスワードリセット (PasswordService.resetPassword) =====

    @Test
    @DisplayName("Issue#6 - パスワードリセット: 成功時に通知メールが送信される")
    void testResetPassword_Success_SendsNotificationEmail() {
        String token = "valid-reset-token";
        PasswordResetToken resetToken = new PasswordResetToken(
                1L, token, new Date(System.currentTimeMillis() + 30 * 60 * 1000));
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);

        when(passwordResetTokenRepository.findByToken(token)).thenReturn(Optional.of(resetToken));
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode(NEW_PASSWORD)).thenReturn("$2a$10$newhashedpassword");

        passwordService.resetPassword(token, NEW_PASSWORD);

        verify(emailService).send(eq(TEST_EMAIL), contains("パスワード"), anyString());
    }

    // ===== アカウント削除 (AccountService.deleteAccount) =====

    @Test
    @DisplayName("Issue#20 - アカウント削除: パスワード不一致でUnauthorizedException")
    void testDeleteAccount_WrongPassword_ThrowsUnauthorized() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(WRONG_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(false);

        assertThatThrownBy(() -> accountService.deleteAccount(TEST_EMAIL, WRONG_PASSWORD, false))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessageContaining("パスワードが正しくありません");
    }

    // ===== ログイン (AuthService.loginUser) =====

    @Test
    @DisplayName("Issue#54 - ログイン: メール未認証でEmailNotVerifiedException")
    void testLoginUser_UnverifiedEmail_ThrowsException() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setEmailVerified(false);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);

        LoginRequest request = new LoginRequest(TEST_EMAIL, CURRENT_PASSWORD);

        assertThatThrownBy(() -> authService.loginUser(request))
                .isInstanceOf(com.photlas.backend.exception.EmailNotVerifiedException.class)
                .hasMessageContaining("メールアドレスが認証されていません");
    }

    @Test
    @DisplayName("Issue#54 - ログイン: SUSPENDEDロールでAccountSuspendedException")
    void testLoginUser_SuspendedRole_ThrowsAccountSuspended() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setEmailVerified(true);
        user.setRole(CodeConstants.ROLE_SUSPENDED);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);

        LoginRequest request = new LoginRequest(TEST_EMAIL, CURRENT_PASSWORD);

        assertThatThrownBy(() -> authService.loginUser(request))
                .isInstanceOf(AccountSuspendedException.class)
                .hasMessageContaining("アカウントが停止されています");
    }

    // ===== ユーザー名更新 (ProfileService.updateUsername) =====

    @Test
    @DisplayName("Issue#29 - ユーザー名更新: 他ユーザーと同じユーザー名でも更新成功する（重複許可）")
    void testUpdateUsername_DuplicateUsername_Succeeds() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String result = profileService.updateUsername(TEST_EMAIL, DUPLICATE_USERNAME);

        assertThat(result).isEqualTo(DUPLICATE_USERNAME);
        verify(userRepository).save(argThat(u -> DUPLICATE_USERNAME.equals(u.getUsername())));
    }

    @Test
    @DisplayName("Issue#29 - ユーザー名更新: 新しいユーザー名が正常に更新される")
    void testUpdateUsername_NewUsername_Succeeds() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String result = profileService.updateUsername(TEST_EMAIL, NEW_USERNAME);

        assertThat(result).isEqualTo(NEW_USERNAME);
        verify(userRepository).save(argThat(u -> NEW_USERNAME.equals(u.getUsername())));
    }

    // ===== Issue#72: ソフトデリート（論理削除） =====

    @Test
    @DisplayName("Issue#72 - アカウント削除: deleted_atが設定され、物理削除されない")
    void testDeleteAccount_SetsDeletedAt_DoesNotPhysicallyDelete() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        verify(userRepository, never()).delete(any(User.class));
        verify(userRepository).save(argThat(u -> u.getDeletedAt() != null));
    }

    @Test
    @DisplayName("Issue#72 - アカウント削除: ユーザー名がランダム文字列に書き換わり、original_usernameに元の値が保存される")
    void testDeleteAccount_RandomizesUsername_PreservesOriginal() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        verify(userRepository).save(argThat(u ->
                TEST_USERNAME.equals(u.getOriginalUsername()) &&
                !TEST_USERNAME.equals(u.getUsername()) &&
                u.getUsername().startsWith("d_")
        ));
    }

    @Test
    @DisplayName("Issue#92 - ログイン: 退会済みユーザーが誤ったパスワードでログインすると汎用エラーで拒否される")
    void testLoginUser_DeletedUser_WrongPassword_ThrowsGenericError() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setEmailVerified(true);
        user.setDeletedAt(java.time.LocalDateTime.now());
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(false);

        LoginRequest request = new LoginRequest(TEST_EMAIL, CURRENT_PASSWORD);

        assertThatThrownBy(() -> authService.loginUser(request))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("メールアドレスまたはパスワードが正しくありません");

        // パスワード検証が呼ばれていることを確認（Issue#92: パスワード検証を先に実行）
        verify(passwordEncoder).matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH);
    }

    @Test
    @DisplayName("Issue#72 - 登録: 退会済みメールアドレスで登録すると専用エラーメッセージ")
    void testRegisterUser_DeletedEmail_ThrowsSpecificError() {
        User deletedUser = createMockUser(1L, TEST_EMAIL, "deleted_abc123");
        deletedUser.setDeletedAt(java.time.LocalDateTime.now().minusDays(10));
        when(userRepository.existsByEmail(TEST_EMAIL)).thenReturn(true);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(deletedUser));

        RegisterRequest request = new RegisterRequest();
        request.setEmail(TEST_EMAIL);
        request.setPassword(CURRENT_PASSWORD);
        request.setUsername("newuser");

        assertThatThrownBy(() -> authService.registerUser(request))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("退会処理中");
    }

    @Test
    @DisplayName("Issue#72 - 退会時にスポットのcreated_by_user_idが他ユーザーに切り替わる")
    void testDeleteAccount_TransfersSpotOwnership() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        User otherUser = createMockUser(2L, OTHER_EMAIL, "otheruser");

        Spot spot = new Spot();
        spot.setSpotId(100L);
        spot.setCreatedByUserId(1L);

        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(spotRepository.findByCreatedByUserId(1L)).thenReturn(java.util.List.of(spot));
        when(photoRepository.findOldestActiveUserBySpotExcluding(100L, 1L)).thenReturn(Optional.of(otherUser));

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        assertThat(spot.getCreatedByUserId()).isEqualTo(2L);
    }

    // ===== Issue#90: アカウント削除確認メール =====

    @Test
    @DisplayName("Issue#90 - アカウント削除: 確認メールが送信される（元のユーザー名で宛名が記載される）")
    void testDeleteAccount_SendsConfirmationEmail() {
        // Arrange
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        // Assert: 元のユーザー名と90日間保持の案内を含むメールが送信されること
        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("アカウント削除"),
                argThat(body -> body.contains(TEST_USERNAME) && body.contains("90日間"))
        );
    }

    @Test
    @DisplayName("Issue#90 - アカウント削除: メール送信失敗時も削除処理は成功する")
    void testDeleteAccount_EmailFailure_DoesNotAffectDeletion() {
        // Arrange
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new RuntimeException("SMTP error")).when(emailService).send(anyString(), anyString(), anyString());

        // Act - 例外がスローされないこと
        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        // Assert: 削除処理は完了していること
        verify(userRepository).save(argThat(u -> u.getDeletedAt() != null));
    }

    // ===== Issue#91: メールの英語対応 =====

    @Test
    @DisplayName("Issue#91 - アカウント削除: 英語ユーザーには英語の確認メールが送信される")
    void testDeleteAccount_EnglishUser_SendsEnglishEmail() {
        // Arrange
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setLanguage("en");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        // Assert: 英語のメールが送信されること
        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("Account Deletion"),
                argThat(body -> body.contains("Your account has been deleted")
                        && body.contains("90 days"))
        );
    }

    @Test
    @DisplayName("Issue#91 - パスワード変更通知: 英語ユーザーには英語の通知メールが送信される")
    void testPasswordChanged_EnglishUser_SendsEnglishEmail() {
        // Arrange
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setLanguage("en");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        passwordService.updatePassword(TEST_EMAIL, CURRENT_PASSWORD, NEW_PASSWORD);

        // Assert: 英語の通知メールが送信されること
        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("Password Changed"),
                argThat(body -> body.contains("Your account password has been changed"))
        );
    }

    // ===== Issue#81 Phase 4b: OAuth のみユーザーの退会（password_hash == null） =====

    @Test
    @DisplayName("[Issue#81 4-A-T4] OAuth のみユーザーの退会: passwordEncoder.matches() は呼ばれず confirmationChecked=true で削除成功")
    void testDeleteAccount_OAuthOnlyUser_SkipsPasswordValidation() {
        // Arrange: password_hash == null の OAuth のみユーザー
        User oauthOnlyUser = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        oauthOnlyUser.setPasswordHash(null);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(oauthOnlyUser));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Act: password=null, confirmationChecked=true で退会
        accountService.deleteAccount(TEST_EMAIL, null, true);

        // Assert:
        //   - passwordEncoder.matches() は一度も呼ばれていない（password=null のため）
        //   - deleted_at が設定されて save される
        verify(passwordEncoder, never()).matches(anyString(), anyString());
        verify(userRepository).save(argThat(u -> u.getDeletedAt() != null));
    }

    // ===== Issue#81 Phase 4d: 退会メール 3 パターン × 2 言語 + revoke 統合 =====

    /**
     * NORMAL ja ゴールデンテスト用の既存文面（Round 12 / Q15 / [4-B]）。
     * <p>リリース前の退会メール文面を一字一句変えないことを担保する。
     * リファクタ後も本文字列と完全一致するよう実装する。
     */
    private static final String EXPECTED_NORMAL_JA_BODY_TEMPLATE =
            "%s さん\n\n" +
            "アカウントの削除が完了しました。\n\n" +
            "お客様のデータは90日間保持されます。90日経過後、すべてのデータが完全に削除されます。\n\n" +
            "アカウントを復旧したい場合は、90日以内にメールアドレスとパスワードでログインしてください。\n\n" +
            "この操作に心当たりがない場合は、至急以下までご連絡ください。\n" +
            "support@photlas.jp\n\n" +
            "Photlas 運営\nsupport@photlas.jp";

    @Test
    @DisplayName("[Issue#81 4-B NORMAL ja Golden] 通常ユーザー ja: 退会メール本文は既存文面と完全一致")
    void testDeleteAccount_NormalUser_Ja_BodyMatchesExistingVerbatim() {
        User user = normalUserJa();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L)).thenReturn(List.of());

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        String expected = String.format(EXPECTED_NORMAL_JA_BODY_TEMPLATE, TEST_USERNAME);
        verify(emailService).send(eq(TEST_EMAIL), contains("アカウント削除"), eq(expected));
    }

    @Test
    @DisplayName("[Issue#81 4-B NORMAL en] 通常ユーザー en: 既存英文面のキーワードを含む")
    void testDeleteAccount_NormalUser_En_ContainsExistingKeywords() {
        User user = normalUserJa();
        user.setLanguage("en");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L)).thenReturn(List.of());

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("Account Deletion"),
                argThat(body -> body.contains("Your account has been deleted")
                        && body.contains("90 days")
                        && body.contains("email and password"))
        );
    }

    @Test
    @DisplayName("[Issue#81 4-B HYBRID ja] パスワード + Google 連携ユーザー ja: 両方の復旧経路を案内")
    void testDeleteAccount_HybridUser_Ja_ContainsBothRouteWording() {
        User user = normalUserJa();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L))
                .thenReturn(List.of(connection(com.photlas.backend.entity.OAuthProvider.GOOGLE)));

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("アカウント削除"),
                argThat(body -> body.contains("メールアドレスとパスワード")
                        && body.contains("Google")
                        && body.contains("90日")
                        && body.contains(TEST_USERNAME))
        );
    }

    @Test
    @DisplayName("[Issue#81 4-B HYBRID en] パスワード + LINE 連携ユーザー en: 両方の復旧経路を案内")
    void testDeleteAccount_HybridUser_En_ContainsBothRouteWording() {
        User user = normalUserJa();
        user.setLanguage("en");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L))
                .thenReturn(List.of(connection(com.photlas.backend.entity.OAuthProvider.LINE)));

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("Account Deletion"),
                argThat(body -> body.contains("email and password")
                        && body.contains("LINE")
                        && body.contains("90 days"))
        );
    }

    @Test
    @DisplayName("[Issue#81 4-B OAUTH_ONLY ja] OAuth のみ (Google) ユーザー ja: プロバイダ再サインインのみ案内")
    void testDeleteAccount_OAuthOnlyUser_Ja_ContainsOnlyOAuthRoute() {
        User user = oauthOnlyUserJa();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L))
                .thenReturn(List.of(connection(com.photlas.backend.entity.OAuthProvider.GOOGLE)));

        accountService.deleteAccount(TEST_EMAIL, null, true);

        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("アカウント削除"),
                argThat(body -> body.contains("Google")
                        && body.contains("90日")
                        && body.contains("サインイン")
                        && !body.contains("パスワードでログイン"))
        );
    }

    @Test
    @DisplayName("[Issue#81 4-B OAUTH_ONLY en] OAuth のみ (LINE) ユーザー en: プロバイダ再サインインのみ案内")
    void testDeleteAccount_OAuthOnlyUser_En_ContainsOnlyOAuthRoute() {
        User user = oauthOnlyUserJa();
        user.setLanguage("en");
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L))
                .thenReturn(List.of(connection(com.photlas.backend.entity.OAuthProvider.LINE)));

        accountService.deleteAccount(TEST_EMAIL, null, true);

        verify(emailService).send(
                eq(TEST_EMAIL),
                contains("Account Deletion"),
                argThat(body -> body.contains("LINE")
                        && body.contains("90 days")
                        && body.contains("sign in")
                        && !body.contains("email and password"))
        );
    }

    @Test
    @DisplayName("[Issue#81 Q9] 退会成功時は OAuthTokenRevokeService.revokeForUser(userId) が呼ばれる")
    void testDeleteAccount_InvokesTokenRevokeService() {
        User user = normalUserJa();
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(CURRENT_PASSWORD, TEST_PASSWORD_HASH)).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userOAuthConnectionRepository.findByUserId(1L)).thenReturn(List.of());

        accountService.deleteAccount(TEST_EMAIL, CURRENT_PASSWORD, false);

        verify(oauthTokenRevokeService).revokeForUser(1L);
    }

    // Phase 4d 用テストヘルパー

    private User normalUserJa() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setLanguage("ja");
        return user;
    }

    private User oauthOnlyUserJa() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        user.setPasswordHash(null);
        user.setLanguage("ja");
        return user;
    }

    private com.photlas.backend.entity.UserOAuthConnection connection(
            com.photlas.backend.entity.OAuthProvider provider) {
        com.photlas.backend.entity.UserOAuthConnection conn =
                new com.photlas.backend.entity.UserOAuthConnection();
        conn.setUserId(1L);
        conn.setProviderCode(provider.getCode());
        conn.setProviderUserId("provider-user-" + provider.name());
        return conn;
    }

    // ===== updateProfileのSNSリンク非更新 (ProfileService.updateProfile) =====

    @Test
    @DisplayName("レポート#5-1 - updateProfile: SNSリンクを含むリクエストでもSNSリンクが更新されない")
    void testUpdateProfile_DoesNotUpdateSnsLinks() {
        User user = createMockUser(1L, TEST_EMAIL, TEST_USERNAME);
        when(userRepository.findByEmail(TEST_EMAIL)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setUsername("newname");

        profileService.updateProfile(TEST_EMAIL, request);

        // SNSリンクリポジトリの削除・保存が呼ばれないこと
        verify(userSnsLinkRepository, never()).deleteByUserId(anyLong());
        verify(userSnsLinkRepository, never()).save(any());
    }

    // ===== ヘルパーメソッド =====

    private User createMockUser(Long id, String email, String username) {
        User user = new User();
        user.setId(id);
        user.setEmail(email);
        user.setUsername(username);
        user.setPasswordHash(TEST_PASSWORD_HASH);
        user.setRole(CodeConstants.ROLE_USER);
        user.setEmailVerified(true);
        return user;
    }
}
